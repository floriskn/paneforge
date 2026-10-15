<script lang="ts">
	import { Pane, PaneGroup, PaneResizer } from "paneforge";
	import DotsSixVertical from "phosphor-svelte/lib/DotsSixVertical";

	let sizes = $state<number[]>([]);
</script>

{#snippet handle()}
	<div class="bg-brand flex h-7 min-w-5 items-center justify-center rounded-sm border">
		<DotsSixVertical class="size-4 shrink-0 text-black" weight="bold" />
	</div>
{/snippet}

<div class="mt-4 h-[300px]">
	<PaneGroup
		direction="horizontal"
		doubleClick="even"
		onLayoutChange={(layout) => {
			sizes = layout;
		}}
	>
		<Pane units="pixels" defaultSize={200} minSize={120} maxSize={320}>
			<div class="bg-muted flex h-full flex-col items-center justify-center rounded-lg p-4">
				<span class="font-semibold">Sidebar</span>
				<span class="text-muted-foreground text-sm tabular-nums">
					{Math.round(sizes[0] ?? 0)}px
				</span>
				<span class="text-muted-foreground mt-1 text-xs">120–320px</span>
			</div>
		</Pane>
		<PaneResizer class="bg-background relative flex w-2 items-center justify-center">
			{@render handle()}
		</PaneResizer>
		<Pane>
			<div class="bg-muted flex h-full flex-col items-center justify-center rounded-lg p-4">
				<span class="font-semibold">Content</span>
				<span class="text-muted-foreground text-sm tabular-nums">
					{Math.round(sizes[1] ?? 0)}%
				</span>
				<span class="text-muted-foreground mt-1 text-xs">takes what is left</span>
			</div>
		</Pane>
	</PaneGroup>
</div>

<p class="text-muted-foreground mt-3 text-sm">
	Only the sidebar is sized in pixels. Resize the window: it keeps its width and the content pane,
	which takes a share of the group, absorbs the difference. Double click the handle to even them
	out, or set <code>doubleClick="reset"</code> to send them back to where they started.
</p>
