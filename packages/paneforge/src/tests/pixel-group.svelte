<script lang="ts">
	import { Pane, PaneGroup, PaneResizer } from "$lib/index.js";

	let {
		onLayout,
		groupRect = "0,0,600,400",
	}: {
		onLayout: (layout: number[]) => void;
		groupRect?: string;
	} = $props();
</script>

<!-- 600px wide with a 4px resizer, so the panes have 596px to share. -->
<PaneGroup
	direction="horizontal"
	units="pixels"
	id="root"
	onLayoutChange={onLayout}
	data-rect={groupRect}
>
	<Pane defaultSize={200} minSize={100} maxSize={300} data-testid="sidebar" />
	<PaneResizer id="root-resizer" data-rect="200,0,204,400" data-testid="resizer" />
	<Pane data-testid="content" />
</PaneGroup>
