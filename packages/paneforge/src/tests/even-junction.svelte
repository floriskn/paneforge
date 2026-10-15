<script lang="ts">
	import { Pane, PaneGroup, PaneJunctions, PaneResizer } from "$lib/index.js";
	import type { PaneDoubleClick } from "$lib/index.js";

	let {
		onRootLayout,
		onLeftLayout,
		onRightLayout,
		doubleClick = "even",
		rightDoubleClick = "even",
		onRootResizerDoubleClick,
	}: {
		onRootLayout: (layout: number[]) => void;
		onLeftLayout: (layout: number[]) => void;
		onRightLayout: (layout: number[]) => void;
		doubleClick?: PaneDoubleClick;
		/** Set apart so one group can sit out while the others are acted on. */
		rightDoubleClick?: PaneDoubleClick;
		/** A handler of one's own on the resizer the junction is rendered inside. */
		onRootResizerDoubleClick?: () => void;
	} = $props();
</script>

<!--
	The same shape as `junction-grid`, so the three resizers meet in one cross, but with every
	group split unevenly to begin with. The rects say where the resizers are, which is all
	junction detection reads.
-->
<PaneGroup
	direction="horizontal"
	id="root"
	{doubleClick}
	onLayoutChange={onRootLayout}
	data-rect="0,0,400,400"
>
	<Pane defaultSize={30}>
		<PaneGroup
			direction="vertical"
			id="left"
			{doubleClick}
			onLayoutChange={onLeftLayout}
			data-rect="0,0,198,400"
		>
			<Pane defaultSize={25} />
			<PaneResizer id="left-resizer" data-rect="0,198,198,202" data-testid="left-resizer" />
			<Pane defaultSize={75} />
		</PaneGroup>
	</Pane>
	<PaneResizer
		id="root-resizer"
		data-rect="198,0,202,400"
		data-testid="root-resizer"
		ondblclick={onRootResizerDoubleClick}
	/>
	<Pane defaultSize={70}>
		<PaneGroup
			direction="vertical"
			id="right"
			doubleClick={rightDoubleClick}
			onLayoutChange={onRightLayout}
			data-rect="202,0,400,400"
		>
			<Pane defaultSize={20} />
			<PaneResizer
				id="right-resizer"
				data-rect="202,198,400,202"
				data-testid="right-resizer"
			/>
			<Pane defaultSize={80} />
		</PaneGroup>
	</Pane>
	<PaneJunctions data-testid="junction" />
</PaneGroup>
