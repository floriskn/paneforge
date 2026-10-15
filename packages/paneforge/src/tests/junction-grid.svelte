<script lang="ts">
	import { Pane, PaneGroup, PaneJunctions, PaneResizer } from "$lib/index.js";

	let {
		onRootLayout,
		onLeftLayout,
		onRightLayout,
		splitRight = true,
		rightSplitAt = 198,
		rightTopMinSize,
		onAnchorDragging,
		onDragging,
	}: {
		onRootLayout: (layout: number[]) => void;
		onLeftLayout: (layout: number[]) => void;
		onRightLayout: (layout: number[]) => void;
		splitRight?: boolean;
		rightSplitAt?: number;
		/** A floor on the right column's top pane, so the two columns cannot go equally far. */
		rightTopMinSize?: number;
		onAnchorDragging?: (isDragging: boolean) => void;
		/** Called for every resizer, with its id, whenever its dragging state changes. */
		onDragging?: (id: string, isDragging: boolean) => void;
	} = $props();
</script>

<PaneGroup direction="horizontal" id="root" onLayoutChange={onRootLayout} data-rect="0,0,400,400">
	<Pane defaultSize={50}>
		<PaneGroup
			direction="vertical"
			id="left"
			onLayoutChange={onLeftLayout}
			data-rect="0,0,198,400"
		>
			<Pane defaultSize={50} />
			<PaneResizer
				id="left-resizer"
				data-rect="0,198,198,202"
				onDraggingChange={(isDragging) => onDragging?.("left-resizer", isDragging)}
			/>
			<Pane defaultSize={50} />
		</PaneGroup>
	</Pane>
	<PaneResizer
		id="root-resizer"
		data-rect="198,0,202,400"
		onDraggingChange={(isDragging) => {
			onAnchorDragging?.(isDragging);
			onDragging?.("root-resizer", isDragging);
		}}
	/>
	<Pane defaultSize={50}>
		{#if splitRight}
			<PaneGroup
				direction="vertical"
				id="right"
				onLayoutChange={onRightLayout}
				data-rect="202,0,400,400"
			>
				<Pane defaultSize={50} minSize={rightTopMinSize} />
				<PaneResizer
					id="right-resizer"
					data-rect="202,{rightSplitAt},400,{rightSplitAt + 4}"
					onDraggingChange={(isDragging) => onDragging?.("right-resizer", isDragging)}
				/>
				<Pane defaultSize={50} />
			</PaneGroup>
		{/if}
	</Pane>
	<PaneJunctions data-testid="junction" />
</PaneGroup>
