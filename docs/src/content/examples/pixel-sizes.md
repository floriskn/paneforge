---
title: Pixel Sizes
description: An example of sizing a pane in pixels rather than as a share of the group.
section: Examples
---

<script>
	import { PixelSizesDemo } from '$lib/components/demos'
	import ViewExampleCode from '$lib/components/view-example-code.svelte'
</script>

<PixelSizesDemo />

<ViewExampleCode href="https://github.com/svecosystem/paneforge/blob/main/docs/src/lib/components/demos/pixel-sizes-demo.svelte" />

## Anatomy

Set `units="pixels"` on a pane and every size on it is read in pixels — `defaultSize`,
`minSize`, `maxSize`, `collapsedSize`, and the sizes it reports back.

```svelte {6}
<script lang="ts">
	import { PaneGroup, Pane, PaneResizer } from "paneforge";
</script>

<PaneGroup direction="horizontal">
	<Pane units="pixels" defaultSize={200} minSize={120} maxSize={320}>Sidebar</Pane>
	<PaneResizer />
	<Pane>Content</Pane>
</PaneGroup>
```

That is the whole of it. The sidebar is 200px wide and stays 200px wide; the pane beside it
is left alone, so it takes a share of the group and absorbs whatever changes.

## What the two units mean

**A share follows the group.** A `percentage` pane takes its share of the group, so it grows
and shrinks with it. This is the default, and a group of nothing but shares behaves exactly
as it always has.

**Pixels are absolute.** A `pixels` pane keeps its size when the group changes size. Resize
the window and the sidebar above is still 200px.

They are the two ways flexbox sizes a child, which is what lets them share a group: an
absolute size becomes a `flex-basis`, taken out of the group first, and a share becomes a
`flex-grow` weight over what is left.

## Where the difference goes

When the group changes size, something has to give. It is offered to the panes taking a share
first, split between them in proportion to what they already have, so their shares of one
another are left alone.

Only what they cannot take is taken from the panes holding an absolute size, working
backwards from the last. So a fixed sidebar gives way only once nothing else can — when the
pane beside it has reached its own `minSize`, say — and is the last thing to be squeezed.

If no pane can give way at all, the sizes are scaled to fit as a last resort, so the panes
always fill the group.

## Limits in pixels

A size can name its own unit, whatever the pane is sized in. That matters most for `minSize`:
a limit given as a share is a different number of pixels at every group size, so the same
editor has a different smallest size at every nesting depth. In pixels it is the same
everywhere, which is how VS Code behaves.

```svelte {2}
<PaneGroup direction="vertical">
	<Pane defaultSize={70} minSize="120px">Editor</Pane>
	<PaneResizer />
	<Pane defaultSize={30} minSize="80px">Terminal</Pane>
</PaneGroup>
```

Both panes here still take a share of the group, so they follow it as it resizes — they simply
refuse to go below a width their contents need. `maxSize` and `defaultSize` read the same way,
and `"40%"` works on a pane sized in pixels for the same reason in reverse.

If the group shrinks so far that a pane's pixel minimum no longer fits its share, the layout is
pulled back to respect it — taking the space from whichever pane can give it.

A limit in pixels is also handed to flexbox, as a `min-width` or `min-height` on the pane along
the axis its group runs. A share of the group has to make a round trip through a percentage to
become pixels again, which leaves it a fraction of a pixel out; flex holds an item at its own
minimum exactly, so a pane told it may not go below 48px measures 48px and not 48.02px.

One exception: a collapsible pane is given no floor, since its smallest size is its
`collapsedSize` and a floor would stop it ever reaching it.

## Percentages in a mixed group

A percentage is a share of the **whole group**, pixel panes included. So `minSize={25}` on
the content pane above means a quarter of the group, which is a limit the sidebar will
actually run into as it grows:

```svelte
<PaneGroup direction="horizontal">
	<Pane units="pixels" defaultSize={240} minSize={180}>Sidebar</Pane>
	<PaneResizer />
	<Pane minSize={25}>Content</Pane>
</PaneGroup>
```

The sizes `onLayoutChange` reports are each in that pane's own units, so the array above
reads as `[240, 75]` — pixels for the sidebar, a share of the group for the content pane.
`getSize()` on a pane and `setLayout()` on a group work the same way round.

## Sizing a whole group in pixels

`units` on the group is the default for the panes inside it, for when every pane in a group
should be measured the same way:

```svelte
<PaneGroup direction="horizontal" units="pixels">
	<Pane defaultSize={120} minSize={60}>Top</Pane>
	<PaneResizer />
	<Pane defaultSize={160} minSize={60}>Middle</Pane>
	<PaneResizer />
	<Pane minSize={60}>The rest</Pane>
</PaneGroup>
```

A pane can still say otherwise for itself. Leaving the last pane without a `defaultSize` is
how you say "take whatever is left over", in either unit.

## Evening panes out

Double clicking a resize handle can give every pane in the group the same size. It is off
unless you ask for it:

```svelte
<PaneGroup direction="horizontal" evenOnDoubleClick>
	<!-- ... -->
</PaneGroup>
```

Every pane ends up the same size on screen, whichever unit each of them is written in.
Double clicking a [junction](/docs/components/pane-junctions) does the same to every group it
can move, so a crossing evens out along both axes at once.

The same thing is available as `distributeEvenly()` on the group, if you would rather put it
behind a button or a keyboard shortcut:

```svelte
<script lang="ts">
	import { PaneGroup } from "paneforge";

	let group = $state<PaneGroup>(null!);
</script>

<button onclick={() => group.distributeEvenly()}>Even out</button>

<PaneGroup bind:this={group} direction="horizontal">
	<!-- ... -->
</PaneGroup>
```
