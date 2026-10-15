<script lang="ts">
	import { Pane, PaneGroup, PaneResizer } from "$lib/index.js";
	import type { PaneUnits } from "$lib/index.js";

	let {
		onLayout,
		units = "percentage",
		evenOnDoubleClick = true,
		thirdMinSize,
	}: {
		onLayout: (layout: number[]) => void;
		units?: PaneUnits;
		evenOnDoubleClick?: boolean;
		thirdMinSize?: number;
	} = $props();

	// In pixels the last pane is left without a size, so it takes whatever is left over.
	// That is the usual shape of a pixel layout: fixed sidebars, one pane that absorbs.
	const sizes: Array<number | undefined> =
		units === "pixels" ? [100, 200, undefined] : [20, 30, 50];
</script>

<!-- 600px wide with two 4px resizers, so the panes have 592px to share. -->
<PaneGroup
	direction="horizontal"
	id="root"
	{units}
	{evenOnDoubleClick}
	onLayoutChange={onLayout}
	data-rect="0,0,600,400"
>
	<Pane defaultSize={sizes[0]} data-testid="one" />
	<PaneResizer id="first" data-rect="100,0,104,400" data-testid="first" />
	<Pane defaultSize={sizes[1]} data-testid="two" />
	<PaneResizer id="second" data-rect="304,0,308,400" data-testid="second" />
	<Pane defaultSize={sizes[2]} minSize={thirdMinSize} data-testid="three" />
</PaneGroup>
