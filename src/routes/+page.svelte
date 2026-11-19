<script>
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import manifest from '#lib/data/manifest.json';
	import RangeSlider from '#lib/RangeSlider.svelte';

	const GITHUB_URL = 'https://github.com/pedro-boudoux';

	const sources = manifest.sources.map((s) => ({ ...s }));
	const marks = [];
	for (const s of sources) {
		s.start = marks.length;
		for (const m of s.marks) marks.push({ ...m, s });
	}
	const total = marks.length;

	const CHUNK = 120; // grid cells appended per scroll page
	const EAGER = 6; // images loaded eagerly above the fold
	const LOADER_TARGET = 12; // loads before the "Loading" veil lifts

	// --- state -------------------------------------------------------------
	let cols = $state(6);
	let mobileCols = $state(3);
	let detail = $state(null); // global mark index when a mark is open
	let variant = $state('smooth'); // raw/smooth, compared inside the detail view
	let rendered = $state(CHUNK); // chunked rendering
	let loaderDone = $state(false);
	let loads = 0;
	let sentinel = $state(null);
	let backBtn = $state(null);
	let dImg = $state(null);
	let closing = $state(false); // detail view animating back to the grid
	let bgIn = $state(false); // detail backdrop faded in

	const detailMark = $derived(detail === null ? null : marks[detail]);
	const dGeom = $derived(detailMark ? fitRect(detailMark) : null);

	// environment flags, read once on mount
	let reduceMotion = false;
	let touchDevice = false;

	// --- helpers -----------------------------------------------------------
	const markUrl = (i, v = variant) => {
		const m = marks[i];
		const group = m.g ? `${m.g}/` : '';
		return `sources/${m.s.id}/${v}/${group}${m.n}.svg`;
	};

	const fileName = (i) => {
		const m = marks[i];
		return `seta-${m.s.id}-${m.g || 'plate'}-${m.n}-${variant}.svg`;
	};

	const fmt = (n) => n.toLocaleString('en-US');

	// marks whose grid image has loaded (or errored) — drives the fade-in
	const loadedSet = new SvelteSet();

	function markLoaded(gi) {
		loadedSet.add(gi);
		if (++loads >= LOADER_TARGET) loaderDone = true;
	}

	// images that finished loading before hydration never fire onload — count those too
	function countInitialLoads() {
		for (const btn of document.querySelectorAll('.cell-btn')) {
			if (loads >= LOADER_TARGET) break;
			const img = btn.querySelector('img');
			if (img?.complete) markLoaded(Number(btn.dataset.i));
		}
	}

	// target rect of the expanded mark: fit into the viewport like the reference
	function fitRect(m) {
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const maxW = vw < 768 ? vw * 0.82 : vw * 0.68;
		const maxH = vh * 0.68;
		const ar = m.w / m.h;
		let w = maxW;
		let h = w / ar;
		if (h > maxH) {
			h = maxH;
			w = h * ar;
		}
		return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
	}

	// --- detail view: spring-driven FLIP zoom -------------------------------
	const geo = {
		p: { x: 0, y: 0, s: 1 }, // position: translate + scale, relative to base size
		tg: { x: 0, y: 0, s: 1 },
		v: { x: 0, y: 0, s: 0 }
	};
	let scrub = 0; // wheel-driven downward offset while a mark is open
	let scrubV = 0;
	let geoRaf = 0;
	let lastGeom = null; // base rect the current scale is relative to

	function setImgLayout() {
		if (!dImg || detail === null) return;
		const g = fitRect(marks[detail]);
		lastGeom = g;
		dImg.style.width = `${g.w}px`;
		dImg.style.height = `${g.h}px`;
	}

	function applyGeo() {
		if (!dImg || detail === null) return;
		const fade = 1 - Math.min(scrub / (window.innerHeight * 0.5), 1) * 0.5;
		dImg.style.transform = `translate3d(${geo.p.x}px, ${geo.p.y + scrub}px, 0) scale(${geo.p.s})`;
		dImg.style.opacity = fade;
	}

	function detailLoop() {
		if (detail === null) {
			geoRaf = 0;
			return;
		}
		// scrub springs back toward zero once the wheel rests
		scrubV += -scrub * 0.09;
		scrubV *= 0.8;
		scrub += scrubV;

		let settled = true;
		if (reduceMotion) {
			scrub = 0;
			scrubV = 0;
			for (const k of ['x', 'y', 's']) geo.p[k] = geo.tg[k];
			geo.v = { x: 0, y: 0, s: 0 };
		} else {
			for (const k of ['x', 'y', 's']) {
				const d = geo.tg[k] - geo.p[k];
				geo.v[k] = (geo.v[k] + d * 0.11) * 0.8;
				const eps = k === 's' ? 0.002 : 0.5;
				if (Math.abs(d) > eps || Math.abs(geo.v[k]) > eps) {
					geo.p[k] += geo.v[k];
					settled = false;
				} else {
					geo.p[k] = geo.tg[k];
					geo.v[k] = 0;
				}
			}
		}
		applyGeo();

		if (closing && settled && Math.abs(scrub) < 1 && Math.abs(scrubV) < 0.6) {
			finalizeClose();
			return;
		}
		geoRaf = requestAnimationFrame(detailLoop);
	}

	function open(i) {
		if (detail !== null) return;
		variant = 'raw';
		const g = fitRect(marks[i]);
		const cellImg = document.querySelector(`[data-i="${i}"] img`);
		const r = cellImg ? cellImg.getBoundingClientRect() : null;
		closing = false;
		bgIn = false;
		scrub = 0;
		scrubV = 0;
		if (r) {
			geo.p = { x: r.x, y: r.y, s: r.width / g.w };
			geo.v = { x: 0, y: 0, s: 0 };
		} else {
			geo.p = { x: g.x, y: g.y, s: 1 };
			geo.v = { x: 0, y: 0, s: 0 };
		}
		geo.tg = { x: g.x, y: g.y, s: 1 };
		detail = i;
	}

	function close() {
		if (detail === null || closing) return;
		closing = true;
		bgIn = false;
		const g = lastGeom ?? fitRect(marks[detail]);
		const cellImg = document.querySelector(`[data-i="${detail}"] img`);
		const r = cellImg?.getBoundingClientRect();
		geo.tg = r ? { x: r.x, y: r.y, s: r.width / g.w } : { ...geo.p };
	}

	function finalizeClose() {
		const i = detail;
		detail = null;
		closing = false;
		if (geoRaf) {
			cancelAnimationFrame(geoRaf);
			geoRaf = 0;
		}
		if (i !== null) {
			queueMicrotask(() => document.querySelector(`[data-i="${i}"]`)?.focus());
		}
	}

	// move between marks: keep the on-screen rect continuous, spring the rest
	function goTo(newIdx) {
		if (closing || detail === null) return;
		const oldG = lastGeom ?? fitRect(marks[detail]);
		detail = newIdx;
		const g = fitRect(marks[detail]);
		const f = oldG.w / g.w;
		geo.p.s *= f;
		geo.v.s *= f;
		geo.tg = { x: g.x, y: g.y, s: 1 };
		setImgLayout();
	}

	function prev() {
		if (detail !== null) goTo((detail - 1 + total) % total);
	}

	function next() {
		if (detail !== null) goTo((detail + 1) % total);
	}

	// scroll down to dismiss, like the reference site: the mark follows the
	// wheel, springs back if released, and closes past a threshold
	function onWheel(e) {
		if (detail === null || closing) return;
		scrub = Math.max(0, Math.min(scrub + e.deltaY, window.innerHeight * 0.5));
		if (scrub > window.innerHeight * 0.22) close();
	}

	// --- keyboard ----------------------------------------------------------
	function onKey(e) {
		if (detail === null) return;
		if (e.key === 'Escape') close();
		else if (e.key === 'ArrowLeft') prev();
		else if (e.key === 'ArrowRight') next();
	}

	// --- velocity bend -----------------------------------
	let mainRaf = 0;
	let vel = 0;
	let lastY = -1;
	let bendActive = false;
	let bendItems = [];
	let bendDirty = false;

	function mainFrame() {
		bendFrame();
		mainRaf = requestAnimationFrame(mainFrame);
	}

	function buildBend() {
		bendItems = [...document.querySelectorAll('.cell')].map((el) => ({
			el,
			top: el.offsetTop,
			bottom: el.offsetTop + el.offsetHeight
		}));
		bendDirty = false;
	}

	function clearBend() {
		for (const it of bendItems) it.el.style.transform = '';
		bendItems = [];
		bendActive = false;
	}

	function bendFrame() {
		if (reduceMotion || touchDevice) return;
		const y = window.scrollY;
		if (lastY < 0) lastY = y;
		vel = vel * 0.86 + (y - lastY) * 0.14;
		lastY = y;
		if (detail !== null) {
			if (bendActive) clearBend();
			return;
		}
		const k = Math.max(-2.4, Math.min(2.4, vel * 0.05));
		if (Math.abs(k) > 0.1) {
			if (!bendActive || bendDirty) buildBend();
			const top = y - window.innerHeight * 0.25;
			const bottom = y + window.innerHeight * 1.25;
			for (const it of bendItems) {
				if (it.bottom >= top && it.top <= bottom) {
					it.el.style.transform = `skewY(${k}deg) scale(${1 - Math.abs(k) * 0.005})`;
				}
			}
			bendActive = true;
		} else if (bendActive) {
			clearBend();
		}
	}

	function onResize() {
		if (detail === null || !lastGeom) return;
		const g = fitRect(marks[detail]);
		const f = lastGeom.w / g.w;
		geo.p.s *= f;
		geo.v.s *= f;
		geo.tg = { x: g.x, y: g.y, s: 1 };
		setImgLayout();
	}

	// cascading reshuffle when the column count changes: toggle .reflow on
	// the grid wrapper; the wave itself is pure CSS (app.css)
	let gridWrapEl = $state(null);
	let reflowT = 0;
	let firstReflow = true;
	$effect(() => {
		cols;
		mobileCols;
		if (firstReflow || !gridWrapEl) {
			firstReflow = false;
			return;
		}
		const el = gridWrapEl;
		el.classList.remove('reflow');
		void el.offsetWidth; // force a style flush so the animations restart
		el.classList.add('reflow');
		clearTimeout(reflowT);
		reflowT = setTimeout(() => el.classList.remove('reflow'), 1500);
	});

	// --- lifecycle ---------------------------------------------------------
	onMount(() => {
		reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		touchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

		try {
			const saved = JSON.parse(localStorage.getItem('seta:cols') || 'null');
			if (saved) {
				if (Number.isInteger(saved.c)) cols = saved.c;
				if (Number.isInteger(saved.m)) mobileCols = saved.m;
			}
		} catch {}

		mainRaf = requestAnimationFrame(mainFrame);

		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					rendered = Math.min(total, rendered + CHUNK);
					if (rendered >= total) io.disconnect();
				}
			},
			{ rootMargin: '2000px 0px' }
		);
		if (sentinel) io.observe(sentinel);

		countInitialLoads();

		window.addEventListener('resize', onResize);

		const t = setTimeout(() => (loaderDone = true), 3000);
		return () => {
			cancelAnimationFrame(mainRaf);
			if (geoRaf) cancelAnimationFrame(geoRaf);
			io.disconnect();
			window.removeEventListener('resize', onResize);
			clearTimeout(t);
		};
	});

	$effect(() => {
		try {
			localStorage.setItem('seta:cols', JSON.stringify({ c: cols, m: mobileCols }));
		} catch {}
	});

	// rebuild the bend cache when the grid changes shape
	$effect(() => {
		rendered;
		cols;
		mobileCols;
		bendDirty = true;
	});

	// lock page scroll while a mark is open
	$effect(() => {
		document.documentElement.classList.toggle('locked', detail !== null);
	});

	// detail view: size the image, start the spring loop, fade the backdrop in
	$effect(() => {
		if (detail === null || !dImg) return;
		setImgLayout();
		applyGeo();
		if (!geoRaf) geoRaf = requestAnimationFrame(detailLoop);
		requestAnimationFrame(() => (bgIn = true));
	});

	// move focus into the dialog while it is open
	$effect(() => {
		if (detail !== null && !closing) backBtn?.focus();
	});

	// preload neighbours while browsing
	$effect(() => {
		if (detail === null) return;
		for (const i of [detail - 1, detail + 1]) {
			if (i >= 0 && i < total) new Image().src = markUrl(i);
		}
	});
</script>

<svelte:window onkeydown={onKey} />

<div class="app" class:detail-mode={detail !== null}>
	{#if !loaderDone}
		<aside class="loader" aria-hidden="true" transition:fade={{ duration: 300 }}>
			<span>Loading</span>
		</aside>
	{/if}

	<header class="header">
		<div class="gradient" aria-hidden="true"></div>
		<h1 class="name">Seta</h1>
		<nav class="close-nav">
			<button type="button" class="text-btn" onclick={close}>Close</button>
		</nav>
		<div class="center-slot">
			<div class="slider-row" class:show={detail === null} inert={detail !== null}>
				<div class="r-desk">
					<RangeSlider label="Desktop grid columns" min={4} max={18} step={2} bind:value={cols} />
				</div>
				<div class="r-mob">
					<RangeSlider label="Mobile grid columns" min={1} max={6} step={1} bind:value={mobileCols} />
				</div>
			</div>
			<div class="compare" class:show={detail !== null} inert={detail === null}>
				<button type="button" class="text-btn cmp" class:active={variant === 'raw'} onclick={() => (variant = 'raw')}>
					Raw
				</button>
				<span class="cmp-sep" aria-hidden="true">/</span>
				<button
					type="button"
					class="text-btn cmp"
					class:active={variant === 'smooth'}
					onclick={() => (variant = 'smooth')}
				>
					Smooth
				</button>
				<a class="text-btn download" href={detail !== null ? markUrl(detail) : '#'} download={detail !== null ? fileName(detail) : undefined}>
					Download
				</a>
			</div>
		</div>
		<div class="right-slot">
			<a class="text-btn credit" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
				compiled by <span class="u">pedro boudoux</span>
			</a>
			<div class="counter" class:show={detail !== null}>
				<span class="cur">{fmt(detail === null ? 1 : detail + 1)}</span>
				<span>{fmt(total)}</span>
			</div>
		</div>
	</header>

	<main>
		<div
			class="grid-wrap"
			bind:this={gridWrapEl}
			style={`--cols: repeat(${cols}, minmax(0, 1fr)); --mcols: repeat(${mobileCols}, minmax(0, 1fr))`}
		>
			{#each sources as s (s.id)}
				{@const visible = Math.max(0, Math.min(s.marks.length, rendered - s.start))}
				<section class="source">
					<ul class="grid">
						{#each s.marks.slice(0, visible) as m, j (s.id + ':' + (m.g || '') + ':' + m.n)}
							{@const gi = s.start + j}
							<li class="cell">
								<button
									type="button"
									class="cell-btn"
									style={`aspect-ratio: ${m.w} / ${m.h}; --ci: ${j % cols}; --cim: ${j % mobileCols}`}
									aria-label={m.n}
									data-i={gi}
									onclick={() => open(gi)}
								>
									<img
										src={markUrl(gi, 'raw')}
										class:ld={loadedSet.has(gi)}
										width={m.w}
										height={m.h}
										alt={m.n}
										loading={gi < EAGER ? 'eager' : 'lazy'}
										fetchpriority={gi < 2 ? 'high' : 'auto'}
										decoding="async"
										onload={() => markLoaded(gi)}
										onerror={() => markLoaded(gi)}
									/>
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
			<div bind:this={sentinel} class="sentinel" aria-hidden="true"></div>
		</div>
	</main>

	{#if detail !== null && detailMark}
		<div class="detail" role="dialog" aria-modal="true" aria-label={detailMark.n} onwheel={onWheel}>
			<button
				type="button"
				class="d-back"
				class:bg-in={bgIn}
				bind:this={backBtn}
				aria-label="Back to grid"
				onclick={close}
			></button>
			<button type="button" class="d-zone d-prev" aria-label="Previous mark" onclick={prev}></button>
			<button type="button" class="d-zone d-next" aria-label="Next mark" onclick={next}></button>
			<img
				bind:this={dImg}
				class="d-img"
				src={markUrl(detail)}
				width={detailMark.w}
				height={detailMark.h}
				alt={detailMark.n}
				draggable="false"
			/>
			{#if dGeom}
				<p class="d-source" class:show={bgIn && !closing} style={`left:${dGeom.x}px; top:${dGeom.y + dGeom.h + 14}px; width:${dGeom.w}px`}>
					{detailMark.s.author} · {detailMark.s.title}{#if detailMark.s.year} · {detailMark.s.year}{/if}
				</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* --- loading veil ------------------------------------------------- */
	.loader {
		position: fixed;
		inset: 0;
		z-index: 999;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: var(--spacing-page-y) var(--spacing-page-x);
		background: var(--color-background);
		cursor: progress;
		pointer-events: none;
	}

	@media (hover: none) and (pointer: coarse) {
		.loader {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.loader {
			display: none;
		}
	}

	/* --- fixed bottom bar ---------------------------------------------- */
	.header {
		position: fixed;
		inset-inline: 0;
		bottom: 0;
		z-index: 100;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--spacing-grid-x);
		padding: var(--spacing-page-y) var(--spacing-page-x);
		pointer-events: none;
	}

	.gradient {
		position: absolute;
		inset-inline: 0;
		bottom: 0;
		height: 60px;
		background: linear-gradient(to bottom, transparent, rgb(253 253 253 / 0.85));
		pointer-events: none;
	}

	.name {
		grid-row: 1;
		grid-column: 1 / span 2;
		align-self: start;
		font-weight: 400;
		pointer-events: auto;
	}

	.close-nav {
		grid-row: 1;
		grid-column: 4;
		display: none;
		justify-content: flex-end;
	}

	/* the slider and the compare controls share one slot, stacked on top of
	   each other — only one is ever visible */
	.center-slot {
		grid-row: 3;
		grid-column: 2 / span 2;
		display: grid;
		align-items: end;
		padding-bottom: 7px;
	}

	.slider-row,
	.compare {
		grid-area: 1 / 1;
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		opacity: 0;
		visibility: hidden;
		/* hidden controls must not intercept pointers; visibility flips
		   after the fade-out finishes */
		transition:
			opacity 0.4s var(--ease),
			visibility 0s 0.4s var(--ease);
	}

	.slider-row.show,
	.compare.show {
		opacity: 1;
		visibility: visible;
		transition: opacity 0.4s var(--ease);
		pointer-events: auto;
	}

	.r-desk {
		display: none;
		width: 100%;
	}

	.r-mob {
		width: 100%;
	}

	.right-slot {
		grid-row: 1 / -1;
		grid-column: 4;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		align-items: flex-end;
	}

	.counter {
		display: flex;
		justify-content: space-between;
		width: 100%;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.4s var(--ease);
	}

	.counter.show {
		opacity: 1;
	}

	.cur {
		color: rgb(22 22 29 / 0.6);
	}

	/* text buttons & links: dim, full on hover, with padded hit areas */
	.text-btn {
		display: inline-block;
		padding-block: 5px;
		margin-block: -5px;
		opacity: 0.6;
		transition: opacity 0.4s var(--ease);
		pointer-events: auto;
	}

	.text-btn:hover {
		opacity: 1;
	}

	.cmp-sep {
		color: rgb(22 22 29 / 0.3);
		margin-inline: 0.6ch;
	}

	.cmp.active {
		opacity: 1;
	}

	.cmp.active:hover {
		opacity: 1;
	}

	.download {
		margin-left: 2ch;
	}

	.u {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.3em;
	}

	/* desktop */
	@media (min-width: 768px) {
		.header {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}

		.gradient {
			height: 90px;
		}

		.name {
			grid-row: 1;
			grid-column: 1;
		}

		.center-slot {
			grid-row: 1;
			grid-column: 3 / span 2;
			align-items: center;
			padding-bottom: 0;
		}

		.right-slot {
			grid-row: 1;
			grid-column: 6;
			justify-content: flex-end;
			gap: 4px;
		}

		.r-desk {
			display: block;
		}

		.r-mob {
			display: none;
		}
	}

	/* mobile: the bar spans the viewport, name on top, controls at the bottom */
	@media (max-width: 767px) {
		.header {
			top: 0;
			grid-template-rows: auto minmax(0, 1fr) auto;
		}

		.name {
			grid-column: 1;
		}

		/* the credit needs more than one column to stay on a single line */
		.right-slot {
			grid-column: 2 / span 3;
		}

		/* detail mode: credit hidden, counter drops to the bottom */
		.app.detail-mode .right-slot {
			justify-content: flex-end;
		}

		.app.detail-mode .close-nav {
			display: flex;
			pointer-events: auto;
		}

		.app.detail-mode .credit {
			display: none;
		}
	}

	/* --- grid ------------------------------------------------------------ */
	main {
		padding: calc(var(--spacing-page-y) * 3.5) var(--spacing-page-x) 90px;
	}

	@media (min-width: 768px) {
		main {
			padding-top: var(--spacing-page-y);
		}
	}

	.source:not(:first-child) {
		margin-top: calc(var(--spacing-page-y) * 2);
	}

	.grid {
		display: grid;
		grid-template-columns: var(--mcols);
		gap: var(--spacing-grid-x);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	@media (min-width: 768px) {
		.grid {
			grid-template-columns: var(--cols);
		}
	}

	.cell {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		min-width: 0;
	}

	.cell-btn {
		display: block;
		width: 100%;
		cursor: zoom-in;
	}

	.cell-btn img {
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 0.4s var(--ease);
	}

	.cell-btn img.ld {
		opacity: 1;
	}

	/* subtle per-cell affordance on touch devices */
	@media (hover: none) and (pointer: coarse) {
		.cell-btn {
			background: rgb(22 22 29 / 0.05);
		}
	}

	.sentinel {
		height: 1px;
	}

	/* --- detail view ------------------------------------------------------ */
	.detail {
		position: fixed;
		inset: 0;
		z-index: 50;
	}

	.d-back {
		position: absolute;
		inset: 0;
		background: var(--color-background);
		cursor: s-resize;
		opacity: 0;
		transition: opacity 0.4s var(--ease);
	}

	.d-back.bg-in {
		opacity: 1;
	}

	.d-zone {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 24%;
		cursor: w-resize;
	}

	.d-next {
		right: 0;
		cursor: e-resize;
	}

	.d-img {
		position: fixed;
		left: 0;
		top: 0;
		z-index: 1;
		transform-origin: 0 0;
		pointer-events: none;
		will-change: transform;
	}

	.d-source {
		position: fixed;
		z-index: 1;
		color: rgb(22 22 29 / 0.6);
		text-align: center;
		opacity: 0;
		transition: opacity 0.4s var(--ease);
		pointer-events: none;
	}

	.d-source.show {
		opacity: 1;
	}
</style>
