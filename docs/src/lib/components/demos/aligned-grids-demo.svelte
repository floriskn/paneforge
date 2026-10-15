<script lang="ts">
	import { Pane, PaneGroup, PaneResizer } from "paneforge";
	import DotsSixVertical from "phosphor-svelte/lib/DotsSixVertical";

	let { align = true }: { align?: boolean } = $props();
</script>

{#snippet cell(label: string)}
	<div class="bg-muted flex h-full items-center justify-center rounded-lg p-4">
		<span class="text-sm font-semibold">{label}</span>
	</div>
{/snippet}

{#snippet column(topLabel: string, bottomLabel: string)}
	<PaneGroup direction="vertical">
		<Pane defaultSize={50}>{@render cell(topLabel)}</Pane>
		<PaneResizer class="bg-background relative flex h-2 items-center justify-center">
			<div class="bg-brand flex h-5 w-7 items-center justify-center rounded-sm border">
				<DotsSixVertical class="size-4 text-black" weight="bold" />
			</div>
		</PaneResizer>
		<Pane defaultSize={50}>{@render cell(bottomLabel)}</Pane>
	</PaneGroup>
{/snippet}

<PaneGroup direction="horizontal" {align}>
	<Pane defaultSize={50}>
		{@render column("One", "Three")}
	</Pane>
	<PaneResizer class="bg-background relative flex w-2 items-center justify-center">
		<div class="bg-brand flex h-7 min-w-5 items-center justify-center rounded-sm border">
			<DotsSixVertical class="size-4 shrink-0 text-black" weight="bold" />
		</div>
	</PaneResizer>
	<Pane defaultSize={50}>
		{@render column("Two", "Four")}
	</Pane>
</PaneGroup>
