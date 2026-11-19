<script>
	let { value = $bindable(6), min = 4, max = 18, step = 2, label = 'Grid columns' } = $props();

	const pct = $derived(((value - min) / (max - min)) * 100);
</script>

<div class="slider">
	<input type="range" aria-label={label} {min} {max} {step} bind:value />
	<div class="line" aria-hidden="true"></div>
	<div class="tick" style={`left: ${pct}%`} aria-hidden="true"></div>
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

	/* ruler tick hanging below the line, at the current position */
	.tick {
		position: absolute;
		top: 3.5px;
		width: 1px;
		height: 13px;
		background: var(--color-foreground);
	}

	/* the native input is invisible but covers the whole area for interaction */
	input {
		position: absolute;
		top: 50%;
		left: 0;
		transform: translateY(-50%);
		width: 100%;
		height: 2rem;
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
