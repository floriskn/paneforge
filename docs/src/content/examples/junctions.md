---
title: Junctions
description: Resize a whole grid of nested panes from the point where their resizers meet.
section: Examples
---

<script>
	import { JunctionsDemo } from '$lib/components/demos'
	import ViewExampleCode from '$lib/components/view-example-code.svelte'
</script>

Drag any of the circles below. Each one moves the resizers that meet there at the same time,
so both axes resize together.

The layout is nested four groups deep, and the single `PaneJunctions` in the outermost group
covers all of it. The junction between **Editor**, **Preview** and **Notes** is formed by a
resizer three levels down meeting one four levels down.

<JunctionsDemo />

<ViewExampleCode href="https://github.com/svecosystem/paneforge/blob/main/docs/src/lib/components/demos/junctions-demo.svelte" />

## Anatomy

`PaneJunctions` finds the junctions itself and renders one element for each, so you never
have to work out where they are or how many there are. Drop a single one into the outermost
group and it covers everything nested inside it.

```svelte
<script lang="ts">
	import { PaneGroup, Pane, PaneResizer, PaneJunctions } from "paneforge";
</script>

<PaneGroup direction="horizontal">
	<Pane defaultSize={50}>
		<PaneGroup direction="vertical">
			<Pane defaultSize={50} />
			<PaneResizer />
			<Pane defaultSize={50} />
		</PaneGroup>
	</Pane>
	<PaneResizer />
	<Pane defaultSize={50}>
		<PaneGroup direction="vertical">
			<Pane defaultSize={50} />
			<PaneResizer />
			<Pane defaultSize={50} />
		</PaneGroup>
	</Pane>

	<PaneJunctions />
</PaneGroup>
```

## Styling the handle

Each junction is sized to the resizers it crosses, which keeps it from stealing room from
them. To draw something larger, render your own element inside it — pointer events still
reach the junction, so the visible handle doubles as the grab area.

```svelte
<PaneJunctions>
	{#snippet child({ props })}
		<div {...props}>
			<div class="junction-handle"></div>
		</div>
	{/snippet}
</PaneJunctions>
```

```css
.junction-handle {
	position: absolute;
	top: 50%;
	left: 50%;
	width: 1.5rem;
	height: 1.5rem;
	transform: translate(-50%, -50%);
	border-radius: 9999px;
	background: var(--brand);
}
```

## Junctions come and go

A junction only exists while resizers actually meet. Drag **Terminal**'s divider up to where
the **Explorer** and **Outline** divider sits, and the two junctions on the middle resizer
merge into a single cross that moves both. Pull them apart again and they split back into
two.

Junctions that merely sit near each other stay independent: dragging one never moves the
other, even where their hit areas overlap. Only resizers that actually line up are driven
together.

You can tell the two apart with the `data-junction-type` attribute, which is `cross` when
resizers meet the junction on both sides and `tee` when only one does:

```css
[data-pane-junction][data-junction-type="tee"] {
	opacity: 0.5;
}
```
