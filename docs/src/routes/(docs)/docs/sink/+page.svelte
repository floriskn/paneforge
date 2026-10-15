<script lang="ts">
	import { Pane, PaneGroup, PaneJunctions, PaneResizer } from "paneforge";
	import type { PaneJunction } from "paneforge";
	import type { Snippet } from "svelte";

	/**
	 * Resizers picked out by whatever the pointer is over. Hovering a junction lights every
	 * resizer meeting there, and hovering a resizer lights the ones linked to it; either way
	 * the others live in a different part of the tree, so CSS cannot reach them — the ids come
	 * off the junction, or off the resizer, instead.
	 */
	let lit = $state<string[]>([]);

	/**
	 * Resizers being dragged, so they stay lit once the pointer has run ahead of them. A
	 * junction reports every resizer it drives, so dragging one lights all of them.
	 */
	let dragging = $state<string[]>([]);

	function setDragging(id: string, isDragging: boolean) {
		dragging = isDragging ? [...dragging, id] : dragging.filter((each) => each !== id);
	}

	const anyDragging = $derived(dragging.length > 0);

	/**
	 * What should be blue.
	 *
	 * While a drag is running, only what is being dragged: the pointer runs across everything
	 * else on its way and each one lighting up as it passes is just noise. `lit` keeps tracking
	 * the pointer underneath, so when the drag ends whatever it is over is lit again — letting
	 * go over a junction leaves the junction lit, as it was before the drag.
	 */
	const shown = $derived(anyDragging ? dragging : lit);
	const isLit = (id: string) => shown.includes(id);

	/**
	 * Whether the bar running through a junction is made of two resizers meeting there.
	 *
	 * Each paints its own bar up to its own edge, which leaves the resizer crossing between
	 * them showing its own width of itself in the middle of what should be one line.
	 */
	function isBridged(junction: PaneJunction) {
		return (["x", "y"] as const).some((axis) => {
			const ids = junction.resizerIds[axis];
			return ids.length > 1 && ids.every(isLit);
		});
	}

	/** Resizers a junction points at, so hovering one lights the whole crossing. */
	const resizersOf = (junction: PaneJunction) => [
		...junction.resizerIds.x,
		...junction.resizerIds.y,
	];

	let gridAlign = $state(true);
</script>

{#snippet bar(id: string)}
	<PaneResizer
		{id}
		class={isLit(id) ? "sink-lit" : ""}
		onDraggingChange={(isDragging) => setDragging(id, isDragging)}
	>
		{#snippet child({ props, junctions, getLinkedIds })}
			<!--
				A divider that lines up with another is dragged together with it, so hovering
				one lights both: two that move as one should look like one.
			-->
			<div
				{...props}
				onmouseenter={() => (lit = [id, ...getLinkedIds()])}
				onmouseleave={() => (lit = [])}
			>
				{@render junctions()}
			</div>
		{/snippet}
	</PaneResizer>
{/snippet}

{#snippet cell(label: string, hint?: string)}
	<div class="sink-cell">
		<span class="sink-label">{label}</span>
		{#if hint}<span class="sink-hint">{hint}</span>{/if}
	</div>
{/snippet}

{#snippet junctionLayer()}
	<PaneJunctions>
		{#snippet child({ props, junction })}
			<div
				{...props}
				class:sink-bridged={isBridged(junction)}
				onmouseenter={() => (lit = resizersOf(junction))}
				onmouseleave={() => {
					lit = [];
				}}
			>
				<span class="sink-junction-hit"></span>
				<span class="sink-junction-bar"></span>
			</div>
		{/snippet}
	</PaneJunctions>
{/snippet}

{#snippet frame(height: string, body: Snippet)}
	<div
		class="vscode-sink w-full overflow-hidden rounded-lg border"
		class:is-dragging={anyDragging}
		style="height: {height}"
	>
		{@render body()}
	</div>
{/snippet}

<!--
	A plain 2x2 grid: four leaf panes, nothing nested below them. `align` on the outer group
	gives the two inner groups one set of sizes, so the divider crossing both halves is a
	single line rather than two that happen to match.
-->
{#snippet quadGrid(prefix: string, outer: "horizontal" | "vertical", labels: string[])}
	{@const inner = outer === "horizontal" ? "vertical" : "horizontal"}
	<PaneGroup direction={outer} align={gridAlign} evenOnDoubleClick>
		<Pane defaultSize={50} minSize={15}>
			<PaneGroup direction={inner} evenOnDoubleClick>
				<Pane defaultSize={50} minSize={15}>{@render cell(labels[0])}</Pane>
				{@render bar(`${prefix}-first`)}
				<Pane defaultSize={50} minSize={15}>{@render cell(labels[1])}</Pane>
			</PaneGroup>
		</Pane>
		{@render bar(`${prefix}-main`)}
		<Pane defaultSize={50} minSize={15}>
			<PaneGroup direction={inner} evenOnDoubleClick>
				<Pane defaultSize={50} minSize={15}>{@render cell(labels[2])}</Pane>
				{@render bar(`${prefix}-second`)}
				<Pane defaultSize={50} minSize={15}>{@render cell(labels[3])}</Pane>
			</PaneGroup>
		</Pane>
		{@render junctionLayer()}
	</PaneGroup>
{/snippet}

{#snippet vscode()}
	<!--
		Only the explorer is sized in pixels. Everything beside it takes a share of the group, so
		the explorer holds its 260px as the window resizes and the editors absorb the difference.

		The editors are bounded in pixels all the same. A minimum written as a share of whatever
		a pane happens to sit inside means the same editor has a different smallest size at every
		nesting depth; in pixels it is the same everywhere, which is what VS Code does.
	-->
	<PaneGroup direction="horizontal" evenOnDoubleClick>
		<Pane units="pixels" defaultSize={260} minSize={180} maxSize={480}>
			{@render cell("Explorer", "260px · min 180 · max 480")}
		</Pane>
		{@render bar("vs-explorer")}
		<Pane minSize="360px">
			<PaneGroup direction="vertical" evenOnDoubleClick>
				<Pane defaultSize={72} minSize="96px">
					<PaneGroup direction="horizontal" evenOnDoubleClick>
						<Pane defaultSize={58} minSize="48px">
							<PaneGroup direction="vertical" evenOnDoubleClick>
								<Pane defaultSize={60} minSize="48px">
									{@render cell("main.ts", "min 48px")}
								</Pane>
								{@render bar("vs-col-a")}
								<Pane defaultSize={40} minSize="48px">
									{@render cell("styles.css", "min 48px")}
								</Pane>
							</PaneGroup>
						</Pane>
						{@render bar("vs-editor")}
						<Pane defaultSize={42} minSize="96px">
							<PaneGroup direction="vertical" evenOnDoubleClick>
								<Pane defaultSize={45} minSize="48px">
									{@render cell("preview.html")}
								</Pane>
								{@render bar("vs-col-b")}
								<Pane defaultSize={55} minSize="48px">
									<PaneGroup direction="horizontal" evenOnDoubleClick>
										<Pane defaultSize={50} minSize="48px">
											{@render cell("notes.md")}
										</Pane>
										{@render bar("vs-row-c")}
										<Pane defaultSize={50} minSize="48px">
											{@render cell("Outline")}
										</Pane>
									</PaneGroup>
								</Pane>
							</PaneGroup>
						</Pane>
					</PaneGroup>
				</Pane>
				{@render bar("vs-terminal")}
				<Pane defaultSize={28} minSize="80px" collapsible collapsedSize={0}>
					{@render cell("Terminal", "min 80px · collapsible")}
				</Pane>
			</PaneGroup>
		</Pane>
		{@render junctionLayer()}
	</PaneGroup>
{/snippet}

{#snippet complex()}
	<PaneGroup direction="horizontal" evenOnDoubleClick>
		<Pane defaultSize={22} minSize={12}>
			<PaneGroup direction="vertical" evenOnDoubleClick>
				<Pane defaultSize={50} minSize={15}>{@render cell("A1")}</Pane>
				{@render bar("cx-a")}
				<Pane defaultSize={50} minSize={15}>
					<PaneGroup direction="horizontal" evenOnDoubleClick>
						<Pane defaultSize={50} minSize={20}>{@render cell("A2")}</Pane>
						{@render bar("cx-a2")}
						<Pane defaultSize={50} minSize={20}>{@render cell("A3")}</Pane>
					</PaneGroup>
				</Pane>
			</PaneGroup>
		</Pane>

		{@render bar("cx-left")}

		<Pane defaultSize={53} minSize={25}>
			<PaneGroup direction="vertical" evenOnDoubleClick>
				<Pane defaultSize={42} minSize={15}>
					<PaneGroup direction="horizontal" evenOnDoubleClick>
						<Pane defaultSize={33} minSize={12}>{@render cell("B1")}</Pane>
						{@render bar("cx-b1")}
						<Pane defaultSize={34} minSize={12}>
							<PaneGroup direction="vertical" evenOnDoubleClick>
								<Pane defaultSize={50} minSize={20}>{@render cell("B2")}</Pane>
								{@render bar("cx-b2")}
								<Pane defaultSize={50} minSize={20}>{@render cell("B3")}</Pane>
							</PaneGroup>
						</Pane>
						{@render bar("cx-b3")}
						<Pane defaultSize={33} minSize={12}>{@render cell("B4")}</Pane>
					</PaneGroup>
				</Pane>
				{@render bar("cx-mid")}
				<Pane defaultSize={58} minSize={15}>{@render cell("B5")}</Pane>
			</PaneGroup>
		</Pane>

		{@render bar("cx-right")}

		<Pane defaultSize={25} minSize={12}>
			<!-- Pixels inside percentages: these rows keep their heights. -->
			<PaneGroup direction="vertical" units="pixels" evenOnDoubleClick>
				<Pane defaultSize={120} minSize={60}>{@render cell("C1", "120px")}</Pane>
				{@render bar("cx-c1")}
				<Pane defaultSize={160} minSize={60}>{@render cell("C2", "160px")}</Pane>
				{@render bar("cx-c2")}
				<Pane minSize={60}>{@render cell("C3", "the rest")}</Pane>
			</PaneGroup>
		</Pane>

		{@render junctionLayer()}
	</PaneGroup>
{/snippet}

{#snippet gridRowsFirst()}
	{@render quadGrid("gv", "vertical", ["Top left", "Top right", "Bottom left", "Bottom right"])}
{/snippet}

{#snippet gridColumnsFirst()}
	{@render quadGrid("gh", "horizontal", ["Top left", "Bottom left", "Top right", "Bottom right"])}
{/snippet}

<div class="flex w-full flex-col gap-10 pb-16">
	<p class="text-muted-foreground text-sm">
		Resizers are 1px until hovered or dragged. Hover a junction and every resizer meeting there
		lights up; hover a divider that is linked to another and both do. Double click a resizer to
		even out its group, or a junction to even out every group it can move.
	</p>

	<section class="space-y-2">
		<h2 class="text-base font-semibold">1 · VS Code shape</h2>
		<p class="text-muted-foreground text-sm">
			A 260px explorer beside editors that take a share of the group, nested five deep, and a
			collapsible terminal. Resize the window: the explorer holds its width. Every editor is
			held to a minimum in pixels, so it is the same smallest size however deeply nested.
		</p>
		{@render frame("560px", vscode)}
	</section>

	<section class="space-y-2">
		<h2 class="text-base font-semibold">2 · Complex nesting</h2>
		<p class="text-muted-foreground text-sm">
			Three columns split differently, with a pixel-measured group nested inside a percentage
			one on the right.
		</p>
		{@render frame("520px", complex)}
	</section>

	<section class="space-y-3">
		<h2 class="text-base font-semibold">3 · 2x2 grids, both ways round</h2>
		<p class="text-muted-foreground text-sm">
			Four leaf panes, nothing nested below them. With <code>align</code> the divider crossing
			both halves is one line, so the middle is a single cross junction. Turn it off and the halves
			drift apart into two separate tee junctions.
		</p>

		<label class="flex w-fit items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={gridAlign} />
			<span><code>align</code> on both outer groups</span>
		</label>

		<div class="grid gap-6 lg:grid-cols-2">
			<div class="space-y-2">
				<h3 class="text-sm font-medium">Vertical outer group — rows first</h3>
				<p class="text-muted-foreground text-xs">
					Rows hold columns, so the shared sizes are the column widths.
				</p>
				{@render frame("340px", gridRowsFirst)}
			</div>

			<div class="space-y-2">
				<h3 class="text-sm font-medium">Horizontal outer group — columns first</h3>
				<p class="text-muted-foreground text-xs">
					Columns hold rows, so the shared sizes are the row heights.
				</p>
				{@render frame("340px", gridColumnsFirst)}
			</div>
		</div>
	</section>
</div>

<style>
	.sink-cell {
		display: flex;
		height: 100%;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.125rem;
		overflow: hidden;
		background-color: var(--color-background-secondary);
	}

	.sink-label {
		font-size: 0.8125rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.sink-hint {
		color: var(--color-muted-foreground);
		font-size: 0.6875rem;
		white-space: nowrap;
	}

	/*
		A junction is only as big as the resizers it crosses, which is 1px square here. Pointer
		events reach it from its children, so this gives it something to be grabbed by.
	*/
	.sink-junction-hit {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 11px;
		height: 11px;
		transform: translate(-50%, -50%);
	}

	/*
		Resizers are rendered by `PaneResizer`, so these have to be global to reach them. The
		wrapper class keeps them to this page.
	*/
	:global(.vscode-sink [data-pane-resizer]) {
		position: relative;
		flex: 0 0 auto;
		background-color: var(--color-border);
	}

	:global(.vscode-sink [data-pane-resizer][data-direction="horizontal"]) {
		width: 1px;
	}

	:global(.vscode-sink [data-pane-resizer][data-direction="vertical"]) {
		height: 1px;
	}

	/* A 1px line is hard to hit, so the grab area reaches past it on both sides. */
	:global(.vscode-sink [data-pane-resizer])::before {
		content: "";
		position: absolute;
		inset: 0;
	}

	:global(.vscode-sink [data-pane-resizer][data-direction="horizontal"])::before {
		inset-inline: -4px;
	}

	:global(.vscode-sink [data-pane-resizer][data-direction="vertical"])::before {
		inset-block: -4px;
	}

	/*
		The wide blue bar is always this size and only fades in, so nothing moves or reflows
		when it appears.
	*/
	:global(.vscode-sink [data-pane-resizer])::after {
		content: "";
		position: absolute;
		background-color: #0078d4;
		opacity: 0;
		transition: opacity 100ms ease-out;
		/*
			Resizers are `position: relative`, so a later one paints its own 1px line over this
			bar and cuts across it. Lifting the bar puts it above them.
		*/
		z-index: 1;
		/* It overlaps the junction, which has to stay grabbable. */
		pointer-events: none;
	}

	:global(.vscode-sink [data-pane-resizer][data-direction="horizontal"])::after {
		top: 0;
		bottom: 0;
		left: 50%;
		width: 4px;
		transform: translateX(calc(-50% + 0.5px));
	}

	:global(.vscode-sink [data-pane-resizer][data-direction="vertical"])::after {
		left: 0;
		right: 0;
		top: 50%;
		height: 4px;
		transform: translateY(calc(-50% - 0.5px));
	}

	/* Hovered, being dragged, or picked out by a junction. */
	:global(.vscode-sink [data-pane-resizer]:hover)::after,
	:global(.vscode-sink [data-pane-resizer][data-active])::after,
	:global(.vscode-sink [data-pane-resizer].sink-lit)::after {
		opacity: 1;
	}

	/*
		Once a drag is under way the pointer runs across everything else on its way, and each
		one lighting up as it passes is just noise. Only what is actually being dragged stays
		lit.
	*/
	:global(.vscode-sink.is-dragging [data-pane-resizer]:hover:not([data-active]))::after {
		opacity: 0;
	}

	/*
		Two resizers meeting at a junction each paint their own bar as far as their own edge,
		and between them lies the resizer they meet — which paints its own line across the two
		and leaves a break in what should read as one continuous bar.

		The junction's box is exactly that overlap: it spans the full thickness of the resizer
		running through it, and sits on the crossing. So this carries the bar across that
		thickness — no measuring, nothing to be a pixel out by, because the box it fills is the
		gap itself. It fades with the same transition as the bars it joins.
	*/
	.sink-junction-bar {
		position: absolute;
		background-color: #0078d4;
		opacity: 0;
		transition: opacity 100ms ease-out;
		/* The junction underneath still has to be grabbable. */
		pointer-events: none;
	}

	/* An `x` junction is rendered in a vertical resizer, so the bar it carries runs across. */
	:global([data-junction-axis="x"]) .sink-junction-bar {
		left: 0;
		right: 0;
		top: 50%;
		height: 4px;
		transform: translateY(-50%);
	}

	:global([data-junction-axis="y"]) .sink-junction-bar {
		top: 0;
		bottom: 0;
		left: 50%;
		width: 4px;
		transform: translateX(-50%);
	}

	:global(.sink-bridged) .sink-junction-bar {
		opacity: 1;
	}
</style>
