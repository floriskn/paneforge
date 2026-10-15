<script lang="ts">
	import { Pane, PaneGroup, PaneResizer } from "$lib/index.js";

	let {
		onLeftLayout,
		onRightLayout,
		align = true,
		rightPanes = 2,
		rightTopMinSize,
		rightTopSize = 70,
		outer = "horizontal",
	}: {
		onLeftLayout: (layout: number[]) => void;
		onRightLayout: (layout: number[]) => void;
		align?: boolean;
		rightPanes?: number;
		rightTopMinSize?: number;
		/** Set to 40 to start the two dividers lined up with one another. */
		rightTopSize?: number;
		/** Which way the group holding the two others runs. */
		outer?: "horizontal" | "vertical";
	} = $props();

	const inner = outer === "horizontal" ? "vertical" : "horizontal";
	// The left divider sits at 160 of 400. The right one follows its own size, so the two
	// line up only when both columns are split the same way.
	const rightDividerAt = $derived(Math.round((rightTopSize / 100) * 400) - 2);
</script>

<!-- A 2x2 grid: two columns, each split into rows. -->
<PaneGroup direction={outer} id="root" {align} data-rect="0,0,400,400">
	<Pane defaultSize={50}>
		<PaneGroup
			direction={inner}
			id="left"
			onLayoutChange={onLeftLayout}
			data-rect="0,0,198,400"
		>
			<Pane defaultSize={40} data-testid="top-left" />
			<PaneResizer id="left-resizer" data-rect="0,158,198,162" data-testid="left-resizer" />
			<Pane defaultSize={60} data-testid="bottom-left" />
		</PaneGroup>
	</Pane>
	<PaneResizer id="root-resizer" data-rect="198,0,202,400" />
	<Pane defaultSize={50}>
		<PaneGroup
			direction={inner}
			id="right"
			onLayoutChange={onRightLayout}
			data-rect="202,0,400,400"
		>
			<Pane defaultSize={rightTopSize} minSize={rightTopMinSize} data-testid="top-right" />
			<PaneResizer
				id="right-resizer"
				data-rect="202,{rightDividerAt},400,{rightDividerAt + 4}"
				data-testid="right-resizer"
			/>
			{#if rightPanes >= 2}
				<Pane
					defaultSize={rightPanes >= 3 ? 20 : 100 - rightTopSize}
					data-testid="bottom-right"
				/>
			{/if}
			{#if rightPanes >= 3}
				<PaneResizer id="right-extra" data-rect="202,340,400,344" />
				<Pane defaultSize={10} data-testid="extra-right" />
			{/if}
		</PaneGroup>
	</Pane>
</PaneGroup>
