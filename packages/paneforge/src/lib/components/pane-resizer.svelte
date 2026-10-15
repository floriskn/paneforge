<script lang="ts">
	import { box, mergeProps } from "svelte-toolbelt";
	import type { PaneResizerProps } from "./types.js";
	import { noop } from "$lib/internal/helpers.js";
	import { PaneResizerState } from "$lib/paneforge.svelte.js";

	const uid = $props.id();

	let {
		id = uid,
		ref = $bindable(null),
		disabled = false,
		onDraggingChange = noop,
		tabindex = 0,
		child,
		children,
		...restProps
	}: PaneResizerProps = $props();

	const resizerState = PaneResizerState.create({
		id: box.with(() => id),
		ref: box.with(
			() => ref,
			(v) => (ref = v)
		),
		disabled: box.with(() => disabled),
		onDraggingChange: box.with(() => onDraggingChange),
		tabIndex: box.with(() => tabindex),
	});

	const mergedProps = $derived(mergeProps(restProps, resizerState.props));
</script>

<!--
	A junction sits at the end of the resizer it is anchored to, and flex has already put
	that resizer in the right place, so rendering it here needs no measured coordinates.
-->
{#snippet junctions()}
	{#each resizerState.hostedJunctions as hosted (hosted.junction.id)}
		{#if hosted.child}
			{@render hosted.child({ props: hosted.props, junction: hosted.junction })}
		{:else}
			<div {...hosted.props}>
				{@render hosted.children?.({ junction: hosted.junction })}
			</div>
		{/if}
	{/each}
{/snippet}

{#if child}
	{@render child({ props: mergedProps, junctions, getLinkedIds: resizerState.getLinkedIds })}
{:else}
	<div {...mergedProps}>
		{@render children?.()}
		{@render junctions()}
	</div>
{/if}
