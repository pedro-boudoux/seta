<script>
	let { value = $bindable(6), min = 4, max = 18, step = 2, label = 'Grid columns' } = $props();

	const pct = $derived(((value - min) / (max - min)) * 100);
</script>

<div class="slider">
	<input type="range" aria-label={label} {min} {max} {step} bind:value />
	<div class="line" aria-hidden="true"></div>
	<div class="knob" style={`left: ${pct}%`} aria-hidden="true">
		<span class="knob-val">{value}</span>
	</div>
</div>

<style>
	.slider {
		position: relative;
		width: 100%;
		height: 1px;
	}

	.line {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 1px;
		background: var(--color-foreground);
	}

	/* the handle: a dot that glides between the stepped positions,
	   growing slightly when hovered or dragged */
	.knob {
		position: absolute;
		top: 50%;
		left: 0;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--color-foreground);
		transform: translate(-50%, -50%);
		transition:
			left 0.2s cubic-bezier(0.4, 0, 0.2, 1),
			scale 0.2s var(--ease);
	}

	.slider:hover .knob,
	.slider:has(input:active) .knob {
		scale: 1.4;
	}

	/* the current value, shown above the handle while interacting */
	.knob-val {
		position: absolute;
		bottom: 12px;
		left: 50%;
		translate: -50% 0;
		font-size: 1.2rem;
		line-height: 1;
		color: var(--color-foreground);
		opacity: 0;
		transition: opacity 0.2s var(--ease);
		pointer-events: none;
	}

	.slider:hover .knob-val,
	.slider:has(input:active) .knob-val {
		opacity: 0.6;
	}

	/* the native input stays invisible but provides a generous hit area */
	input {
		position: absolute;
		top: 50%;
		left: 0;
		transform: translateY(-50%);
		width: 100%;
		height: 3.6rem;
		margin: 0;
		opacity: 0;
		cursor: ew-resize;
		appearance: none;
		-webkit-appearance: none;
		background: transparent;
		touch-action: pan-x;
	}

	input::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		opacity: 0;
	}
</style>
