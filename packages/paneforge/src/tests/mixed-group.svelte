<script lang="ts">
	import { Pane, PaneGroup, PaneResizer } from "$lib/index.js";
	import type { PaneSize, PaneUnits } from "$lib/index.js";

	let {
		onLayout,
		groupRect = "0,0,604,400",
		groupUnits = "percentage",
		sidebarUnits = "pixels",
		sidebarSize = 300,
		sidebarMin = 120,
		sidebarMax = 480,
		contentUnits,
		contentMin,
		contentMax,
		contentCollapsible = false,
		aside = false,
	}: {
		onLayout: (layout: number[]) => void;
		groupRect?: string;
		/** The unit the panes take unless they say for themselves. */
		groupUnits?: PaneUnits;
		sidebarUnits?: PaneUnits;
		sidebarSize?: number;
		sidebarMin?: PaneSize;
		sidebarMax?: PaneSize;
		contentUnits?: PaneUnits;
		/**
		 * A share of the whole group when given as a number, since the content pane sizes
		 * itself as one — or whatever it names, as `"320px"`.
		 */
		contentMin?: PaneSize;
		contentMax?: PaneSize;
		/** A collapsible pane has to be able to reach its collapsed size, minimum or not. */
		contentCollapsible?: boolean;
		/** Adds a second pane sizing itself as a share, to watch the two share a change. */
		aside?: boolean;
	} = $props();
</script>

<!--
	604px wide with a 4px resizer, so the panes have 600px to share: 300px for the sidebar
	leaves 300px, which is the half of the group the content pane reports.

	With `aside`, a second 4px resizer brings it to 608px wide for the same 600px.
-->
<PaneGroup
	direction="horizontal"
	units={groupUnits}
	id="root"
	onLayoutChange={onLayout}
	data-rect={aside ? "0,0,608,400" : groupRect}
>
	<Pane
		units={sidebarUnits}
		defaultSize={sidebarSize}
		minSize={sidebarMin}
		maxSize={sidebarMax}
		data-testid="sidebar"
	/>
	<PaneResizer id="root-resizer" data-rect="300,0,304,400" data-testid="resizer" />
	<Pane
		units={contentUnits}
		minSize={contentMin}
		maxSize={contentMax}
		collapsible={contentCollapsible}
		collapsedSize={contentCollapsible ? 0 : undefined}
		data-testid="content"
	/>
	{#if aside}
		<PaneResizer id="aside-resizer" data-rect="454,0,458,400" data-testid="aside-resizer" />
		<Pane defaultSize={25} data-testid="aside" />
	{/if}
</PaneGroup>
