<script lang="ts">
	import { Pane, PaneGroup, PaneJunctions, PaneResizer } from "$lib/index.js";
</script>

<!--
	Four groups deep, arranged so that the three junctions it forms are each hosted by a
	different group: the outermost one, a group one level down, and one two levels down.
-->
<PaneGroup direction="horizontal" id="root" data-rect="0,0,600,400">
	<Pane defaultSize={50} />
	<PaneResizer id="root-resizer" data-rect="300,0,304,400" />
	<Pane defaultSize={50}>
		<PaneGroup direction="vertical" id="mid" data-rect="304,0,600,400">
			<Pane defaultSize={50}>
				<PaneGroup direction="horizontal" id="inner" data-rect="304,0,600,200">
					<Pane defaultSize={50} />
					<PaneResizer id="inner-resizer" data-rect="450,0,454,200" />
					<Pane defaultSize={50}>
						<PaneGroup direction="vertical" id="deep" data-rect="454,0,600,200">
							<Pane defaultSize={50} />
							<PaneResizer id="deep-resizer" data-rect="454,98,600,102" />
							<Pane defaultSize={50} />
						</PaneGroup>
					</Pane>
				</PaneGroup>
			</Pane>
			<PaneResizer id="mid-resizer" data-rect="304,200,600,204" />
			<Pane defaultSize={50} />
		</PaneGroup>
	</Pane>
	<PaneJunctions data-testid="junction" />
</PaneGroup>
