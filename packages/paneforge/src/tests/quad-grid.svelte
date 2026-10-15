<script lang="ts">
	import { Pane, PaneGroup, PaneJunctions, PaneResizer } from "$lib/index.js";

	let {
		onFirst,
		onSecond,
		align = true,
		outer = "horizontal",
	}: {
		onFirst: (layout: number[]) => void;
		onSecond: (layout: number[]) => void;
		align?: boolean;
		outer?: "horizontal" | "vertical";
	} = $props();

	const inner = outer === "horizontal" ? "vertical" : "horizontal";
</script>

<!--
	Mirrors the 2x2 grid in the sink: four leaf panes, both halves the same size, `align` on
	the group that holds them. The rects describe a 400x400 box split down the middle.
-->
<PaneGroup direction={outer} id="root" {align} evenOnDoubleClick data-rect="0,0,400,400">
	<Pane defaultSize={50} minSize={15}>
		<PaneGroup
			direction={inner}
			id="first"
			evenOnDoubleClick
			onLayoutChange={onFirst}
			data-rect="0,0,400,400"
		>
			<Pane defaultSize={50} minSize={15} data-testid="a" />
			<PaneResizer id="first-bar" data-rect="0,199,400,201" data-testid="first-bar" />
			<Pane defaultSize={50} minSize={15} data-testid="b" />
		</PaneGroup>
	</Pane>
	<PaneResizer id="main-bar" data-rect="199,0,201,400" data-testid="main-bar" />
	<Pane defaultSize={50} minSize={15}>
		<PaneGroup
			direction={inner}
			id="second"
			evenOnDoubleClick
			onLayoutChange={onSecond}
			data-rect="0,0,400,400"
		>
			<Pane defaultSize={50} minSize={15} data-testid="c" />
			<PaneResizer id="second-bar" data-rect="0,199,400,201" data-testid="second-bar" />
			<Pane defaultSize={50} minSize={15} data-testid="d" />
		</PaneGroup>
	</Pane>
	<PaneJunctions data-testid="junction" />
</PaneGroup>
