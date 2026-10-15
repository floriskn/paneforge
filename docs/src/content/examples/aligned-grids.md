---
title: Aligned Grids
description: An example of dividers that are dragged together while they line up.
section: Examples
---

<script>
	import { AlignedGridsDemo } from '$lib/components/demos'
	import ViewExampleCode from '$lib/components/view-example-code.svelte'
</script>

Drag the divider in either column. Both move, because they are on the same line.

<div class="mt-4 h-[320px]">
	<AlignedGridsDemo />
</div>

<ViewExampleCode href="https://github.com/svecosystem/paneforge/blob/main/docs/src/lib/components/demos/aligned-grids-demo.svelte" />

## The problem

Split a group into a 2x2 grid and each column keeps its own row sizes. The two row dividers
start out looking like one line, but they are two separate things — drag either and they come
apart.

<div class="mt-4 h-[320px]">
	<AlignedGridsDemo align={false} />
</div>

## The fix

Mark the group that holds the columns as `align`. Dividers in the groups nested inside it are
then dragged together **while they line up**: two on the same line behave as one, and dragging
either moves both.

```svelte {5}
<script lang="ts">
	import { PaneGroup, Pane, PaneResizer } from "paneforge";
</script>

<PaneGroup direction="horizontal" align>
	<Pane defaultSize={50}>
		<PaneGroup direction="vertical">
			<Pane defaultSize={50}>One</Pane>
			<PaneResizer />
			<Pane defaultSize={50}>Three</Pane>
		</PaneGroup>
	</Pane>
	<PaneResizer />
	<Pane defaultSize={50}>
		<PaneGroup direction="vertical">
			<Pane defaultSize={50}>Two</Pane>
			<PaneResizer />
			<Pane defaultSize={50}>Four</Pane>
		</PaneGroup>
	</Pane>
</PaneGroup>
```

It works the same way round: mark a vertical group and the columns inside its rows line up
instead.

## What to expect

**The groups stay independent.** Nothing is shared and nobody's sizes are handed over. Each
group keeps what you gave it, and `onLayoutChange` still reports its own sizes.

**Only dividers that line up travel together.** Two that sit on different lines have nothing
to do with each other. This is worked out from where the dividers actually are each time a
drag starts, so there is no state to keep in step.

**They go as far as all of them can.** Every move is offered to each of them and they all move
by the smallest share any of them could manage, so a pair that started out as one line stays
one line. When one reaches a pane's `minSize`, that is where both stop — the other does not run
on and leave the line broken in two, whatever the panes on either side allow.

**Double clicking acts on both.** With `doubleClick` set, double clicking a linked divider
evens out — or resets — both of their groups, which leaves them on the same line either way.

**It reaches one level.** `align` links the dividers of the groups nested directly inside the
marked group. Mark a nested group too if you want its own children linked.

## Showing that they are linked

Two dividers that move as one should look like one, and a divider does not know from CSS alone
what it is linked to — the other one is somewhere else entirely in the tree. So the resizer's
`child` snippet hands you `getLinkedIds()`, the ids of the resizers that would come along:

```svelte
<PaneResizer {id} class={lit.includes(id) ? "lit" : ""}>
	{#snippet child({ props, junctions, getLinkedIds })}
		<div
			{...props}
			onmouseenter={() => (lit = [id, ...getLinkedIds()])}
			onmouseleave={() => (lit = [])}
		>
			{@render junctions()}
		</div>
	{/snippet}
</PaneResizer>
```

It is measured when called, so it answers for right now: two dividers that have come apart
are no longer linked, and hovering either lights only itself.

## Moving both axes at once

Where two dividers meet a third running across them, that corner is a
[junction](/docs/components/pane-junctions) — dragging it moves every divider that meets
there, along both axes. Junctions need no `align`: they appear wherever resizers touch.
