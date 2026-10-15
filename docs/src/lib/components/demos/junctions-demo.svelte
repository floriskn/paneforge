<script lang="ts">
	import { Pane, PaneGroup, PaneJunctions, PaneResizer } from "paneforge";
	import ArrowsOutCardinal from "phosphor-svelte/lib/ArrowsOutCardinal";
	import DotsSixVertical from "phosphor-svelte/lib/DotsSixVertical";
</script>

{#snippet cell(label: string)}
	<div class="bg-muted flex h-full items-center justify-center rounded-lg p-4">
		<span class="text-sm font-semibold">{label}</span>
	</div>
{/snippet}

{#snippet handle()}
	<div class="bg-brand flex h-7 min-w-5 items-center justify-center rounded-sm border">
		<DotsSixVertical class="size-4 shrink-0 text-black" weight="bold" />
	</div>
{/snippet}

{#snippet crossHandle()}
	<div class="bg-brand flex h-5 w-7 items-center justify-center rounded-sm border">
		<DotsSixVertical class="size-4 text-black" weight="bold" />
	</div>
{/snippet}

<div class="mt-4 h-[520px]">
	<PaneGroup direction="horizontal">
		<!-- Depth 2: a sidebar split in two -->
		<Pane defaultSize={22}>
			<PaneGroup direction="vertical">
				<Pane defaultSize={60}>{@render cell("Explorer")}</Pane>
				<PaneResizer class="bg-background relative flex h-2 items-center justify-center">
					{@render crossHandle()}
				</PaneResizer>
				<Pane defaultSize={40}>{@render cell("Outline")}</Pane>
			</PaneGroup>
		</Pane>

		<PaneResizer class="bg-background relative flex w-2 items-center justify-center">
			{@render handle()}
		</PaneResizer>

		<Pane defaultSize={56}>
			<!-- Depth 2 -->
			<PaneGroup direction="vertical">
				<Pane defaultSize={65}>
					<!-- Depth 3 -->
					<PaneGroup direction="horizontal">
						<Pane defaultSize={55}>{@render cell("Editor")}</Pane>
						<PaneResizer
							class="bg-background relative flex w-2 items-center justify-center"
						>
							{@render handle()}
						</PaneResizer>
						<Pane defaultSize={45}>
							<!-- Depth 4 -->
							<PaneGroup direction="vertical">
								<Pane defaultSize={50}>{@render cell("Preview")}</Pane>
								<PaneResizer
									class="bg-background relative flex h-2 items-center justify-center"
								>
									{@render crossHandle()}
								</PaneResizer>
								<Pane defaultSize={50}>{@render cell("Notes")}</Pane>
							</PaneGroup>
						</Pane>
					</PaneGroup>
				</Pane>

				<PaneResizer class="bg-background relative flex h-2 items-center justify-center">
					{@render crossHandle()}
				</PaneResizer>

				<Pane defaultSize={35}>{@render cell("Terminal")}</Pane>
			</PaneGroup>
		</Pane>

		<PaneResizer class="bg-background relative flex w-2 items-center justify-center">
			{@render handle()}
		</PaneResizer>

		<!-- Depth 2 -->
		<Pane defaultSize={22}>
			<PaneGroup direction="vertical">
				<Pane defaultSize={50}>{@render cell("Chat")}</Pane>
				<PaneResizer class="bg-background relative flex h-2 items-center justify-center">
					{@render crossHandle()}
				</PaneResizer>
				<Pane defaultSize={50}>{@render cell("Timeline")}</Pane>
			</PaneGroup>
		</Pane>

		<PaneJunctions>
			{#snippet child({ props, junction })}
				<div {...props}>
					<div
						class="bg-brand absolute left-1/2 top-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-transform"
						class:scale-125={junction.isDragging}
					>
						<ArrowsOutCardinal class="size-3.5 text-black" weight="bold" />
					</div>
				</div>
			{/snippet}
		</PaneJunctions>
	</PaneGroup>
</div>
