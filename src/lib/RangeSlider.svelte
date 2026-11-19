<script>
	let { value = $bindable(6), min = 4, max = 18, step = 2, label = 'Grid columns' } = $props();

	const pct = $derived(((value - min) / (max - min)) * 100);
</script>

<div class="slider">
	<input type="range" aria-label={label} {min} {max} {step} bind:value />
	<div class="line" aria-hidden="true"></div>
	<div class="knob" style={`left: ${pct}%`} aria-hidden="true"></div>
</div>

<style>
	/* the slider itself is the full hit strip; the line is drawn through
	   its middle. The native input fills the strip with no transforms —
	   Chromium's range dragging misbehaves on transformed inputs. */
	.slider {
		position: relative;
		width: 100%;
		height: 2.6rem;
	}

	.line {
		position: absolute;
		top: calc(50% - 0.5px);
		left: 0;
		width: 100%;
		height: 1px;
		background: var(--color-foreground);
		pointer-events: none;
	}

	/* the handle: a dot that glides between the stepped positions,
	   growing slightly while the strip is hovered or dragged */
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
		pointer-events: none;
	}

	.slider:hover .knob,
	.slider:has(input:active) .knob {
		scale: 1.4;
	}

	/* the native input is invisible and fills the whole strip. Do NOT
	   restyle ::-webkit-slider-thumb — appearance:none on the thumb breaks
	   Chromium's native drag geometry; input-level opacity hides it anyway. */
	input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: ew-resize;
		appearance: none;
		-webkit-appearance: none;
		background: transparent;
		touch-action: pan-x;
	}
</style>
