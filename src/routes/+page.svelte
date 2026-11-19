<script>
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';
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

	const detailMark = $derived(detail === null ? null : marks[detail]);

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

	function noteLoaded() {
		if (++loads >= LOADER_TARGET) loaderDone = true;
	}

	// images that finished loading before hydration never fire onload — count those too
	function countInitialLoads() {
		for (const img of document.querySelectorAll('.cell-btn img')) {
			if (loads >= LOADER_TARGET) break;
			if (img.complete) noteLoaded();
		}
	}

	function open(i) {
		variant = 'smooth';
		detail = i;
	}

	function close() {
		const i = detail;
		detail = null;
		if (i !== null) {
			queueMicrotask(() => document.querySelector(`[data-i="${i}"]`)?.focus());
		}
	}

	function prev() {
		detail = (detail - 1 + total) % total;
	}

	function next() {
		detail = (detail + 1) % total;
	}

	// --- keyboard ----------------------------------------------------------
	function onKey(e) {
		if (detail === null) return;
		if (e.key === 'Escape') close();
		else if (e.key === 'ArrowLeft') prev();
		else if (e.key === 'ArrowRight') next();
	}

	// scroll down anywhere to go back to the grid, like the reference site
	let wheelAcc = 0;
	let wheelT;
	function onWheel(e) {
		wheelAcc += e.deltaY;
		clearTimeout(wheelT);
		wheelT = setTimeout(() => (wheelAcc = 0), 250);
		if (wheelAcc > 120) close();
	}

	// --- lifecycle ---------------------------------------------------------
	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem('seta:cols') || 'null');
			if (saved) {
				if (Number.isInteger(saved.c)) cols = saved.c;
				if (Number.isInteger(saved.m)) mobileCols = saved.m;
			}
		} catch {}

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

		const t = setTimeout(() => (loaderDone = true), 3000);
		return () => {
			io.disconnect();
			clearTimeout(t);
		};
	});

	$effect(() => {
		try {
			localStorage.setItem('seta:cols', JSON.stringify({ c: cols, m: mobileCols }));
		} catch {}
	});

	// lock page scroll while a mark is open
	$effect(() => {
		document.documentElement.classList.toggle('locked', detail !== null);
	});

	// move focus into the dialog on open
	$effect(() => {
		if (detail !== null) backBtn?.focus();
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
				put together by <span class="u">pedro boudoux</span>
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
			style={`--cols: repeat(${cols}, minmax(0, 1fr)); --mcols: repeat(${mobileCols}, minmax(0, 1fr))`}
		>
			{#each sources as s (s.id)}
				{@const visible = Math.max(0, Math.min(s.marks.length, rendered - s.start))}
				<section class="source">
					<h2 class="source-label">
						{s.author} — {s.title}
						<span class="label-count">{fmt(s.marks.length)} marks</span>
					</h2>
					<ul class="grid">
						{#each s.marks.slice(0, visible) as m, j (s.id + ':' + (m.g || '') + ':' + m.n)}
							{@const gi = s.start + j}
							<li class="cell">
								<button
									type="button"
									class="cell-btn"
									style={`aspect-ratio: ${m.w} / ${m.h}`}
									aria-label={m.n}
									data-i={gi}
									onclick={() => open(gi)}
								>
									<img
										src={markUrl(gi, 'smooth')}
										width={m.w}
										height={m.h}
										alt={m.n}
										loading={gi < EAGER ? 'eager' : 'lazy'}
										fetchpriority={gi < 2 ? 'high' : 'auto'}
										decoding="async"
										onload={noteLoaded}
										onerror={noteLoaded}
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
		<div
			class="detail"
			role="dialog"
			aria-modal="true"
			aria-label={detailMark.n}
			onwheel={onWheel}
			transition:fade={{ duration: 200 }}
		>
			<button type="button" class="d-back" bind:this={backBtn} aria-label="Back to grid" onclick={close}></button>
			<button type="button" class="d-zone d-prev" aria-label="Previous mark" onclick={prev}></button>
			<button type="button" class="d-zone d-next" aria-label="Next mark" onclick={next}></button>
			{#key `${detail}-${variant}`}
				<img
					class="d-img"
					src={markUrl(detail)}
					width={detailMark.w}
					height={detailMark.h}
					alt={detailMark.n}
					draggable="false"
				/>
			{/key}
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
		background: linear-gradient(to bottom, transparent, rgb(253 253 253 / 0.6));
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
		pointer-events: none;
		transition: opacity 0.4s var(--ease);
	}

	.slider-row.show,
	.compare.show {
		opacity: 1;
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

	.source-label {
		margin: 0 0 var(--spacing-grid-x);
		padding-top: calc(var(--spacing-page-y) * 2);
		font-weight: 400;
	}

	.source:first-child .source-label {
		padding-top: 0;
	}

	.label-count {
		color: rgb(22 22 29 / 0.6);
		margin-left: 2ch;
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
		display: grid;
		place-items: center;
	}

	.d-back {
		position: absolute;
		inset: 0;
		background: var(--color-background);
		cursor: s-resize;
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
		position: relative;
		z-index: 1;
		max-width: 82vw;
		max-height: 68vh;
		max-height: 68lvh;
		object-fit: contain;
		pointer-events: none;
	}

	@media (min-width: 768px) {
		.d-img {
			max-width: 68vw;
		}
	}
</style>
