---
title: PaneJunctions
description: Renders a draggable handle wherever perpendicular resizers meet, resizing both at once.
section: Components
---

<script>
	import { PropField } from '@svecodocs/kit'
</script>

A _junction_ is a point where two resizers that move along opposing axes meet. Dragging one
moves every resizer that meets there, so a nested layout can be resized in both directions at
the same time.

The `PaneJunctions` component finds those points for you and renders an element for each one.

## Usage

Put it anywhere inside the outermost group you want covered. It renders nothing itself, so
its position in the markup does not matter. It looks at every group nested within that one,
however deep, so a single instance is usually all you need.

```svelte {21}
<script lang="ts">
	import { PaneGroup, Pane, PaneResizer, PaneJunctions } from "paneforge";
</script>

<PaneGroup direction="horizontal">
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

	<PaneJunctions />
</PaneGroup>
```

## How junctions are found

Junctions are worked out from where the resizers actually sit on screen, not from how the
components are arranged. Two resizers form a junction when they touch, no matter how far
apart their groups are in the tree — a resizer six levels down meets one in the outermost
group just the same as two siblings would.

That also means junctions appear and disappear as the layout changes. Two nested resizers
lined up on either side of an outer one form a single _cross_; drag one out of line and it
becomes two separate _tees_, one at the end of each.

Only resizers that genuinely line up are driven together. Junctions that merely sit near one
another stay independent, so dragging one never moves the other. Where their hit areas
overlap, the one later in paint order takes the pointer — `crossTolerance` controls where
that line falls.

## Where junctions render

Of the resizers meeting at a junction, one runs straight **through** it while the others stop
against it. The junction is rendered inside the one that runs through, for two reasons: it
lies entirely within that resizer, so nothing clips it, and flex has already placed that
resizer across the junction. Only the distance along its length has to be measured.

That resizer becomes `position: relative` so the junction can be positioned against it.
Resizers that anchor nothing are left alone, including ones that take part in a junction
without being the one it runs through.

Junctions are given `z-index: 1`, because resizers are commonly given `position: relative`
and a later one would otherwise paint over a junction rendered inside an earlier one. If your
own handles use a `z-index`, raise the junction to match.

`data-junction-axis` says which way the resizer it sits in runs, and `data-junction-side`
says which side the others arrive from — absent on a cross, which is met from both. Together
they tell you which way a tee points.

```css
/* a tee met only from the left */
[data-pane-junction][data-junction-axis="x"][data-junction-side="start"] {
	border-left: none;
}
```

If a resizer uses its own `child` snippet it no longer renders an element for the junctions
to live in, so render the `junctions` snippet it is given inside whatever element takes its
place:

```svelte
<PaneResizer>
	{#snippet child({ props, junctions })}
		<div {...props}>
			<span class="grip"></span>
			{@render junctions()}
		</div>
	{/snippet}
</PaneResizer>
```

## Dragging as one line

The resizers a junction moves along one axis all meet it at the same point, so they are moved
as one: every move is offered to each of them, and they all move by the smallest share any of
them could manage. A column whose pane has reached its `minSize` is where the whole line stops,
rather than the other columns running on and leaving the line broken in two.

The two axes are independent of one another. One axis running out of room does not hold the
other back.

## Double clicking

Double clicking a junction does what [`doubleClick`](/docs/components/pane-group) does for a
single resizer — applied to every group the junction drags, so a crossing evens out, or resets,
along both axes at once.

Each group has its own say in which of those it is: groups that asked for nothing are left as
they are, and if none of them asked for anything the double click is left alone to be handled
wherever you like.

```svelte
<!-- Double clicking the crossing evens out the rows and the columns together. -->
<PaneGroup direction="horizontal" doubleClick="even">
	<!-- ... -->
	<PaneJunctions />
</PaneGroup>
```

## Accessibility

Every resizer a junction drives is already exposed on its own as a `separator` that can be
moved with the keyboard. A junction is a pointer shortcut for those same resizers rather than
a second route to them, so it is `aria-hidden` and stays out of the tab order. Keyboard users
resize each axis with the resizers themselves.

## Props

<PropField name="disabled" type="boolean" default="false">

Whether the junctions are disabled. The resizers they would drive stay usable on their own.

</PropField>

<PropField name="tolerance" type="number" default="4">

How close, in pixels, resizers must come to count as meeting.

</PropField>

<PropField name="crossTolerance" type="number" default="0.5">

How close, in pixels, two parallel resizers must line up before the junctions they form
become a single cross that drags them together.

Deliberately tight: junctions that only sit near each other stay independent. Raise it to
make crosses easier to form, and to snap nearby splits together as they are dragged.

</PropField>

<PropField name="onDraggingChange" type="(isDragging: boolean, junctionId: string) => void">

A callback that is called when a junction's dragging state changes.

</PropField>

## Snippet Props

Both the `child` and `children` snippets receive the junction being rendered:

```ts
export type PaneJunction = {
	/** A stable id derived from the resizers the junction drives. */
	id: string;
	/** The center of the junction, in viewport coordinates. */
	x: number;
	y: number;
	/** The size of the junction, matching the resizers it crosses. */
	width: number;
	height: number;
	/** Whether resizers meet the junction on both sides, or only one. */
	type: "cross" | "tee";
	/**
	 * Paint order. Where two junctions in the same resizer overlap, the higher index takes
	 * the pointer.
	 */
	index: number;
	/** The resizer it is rendered inside, how far along it, and which side it is met from. */
	anchor: {
		resizerId: string;
		axis: "x" | "y";
		offset: number;
		side: "start" | "end" | undefined;
	};
	/** Whether the junction is currently being dragged. */
	isDragging: boolean;
	/** The ids of the resizers the junction drives, per axis. */
	resizerIds: { x: string[]; y: string[] };
};
```

## Data Attributes

The following data attributes are available on each junction element:

```ts
export type PaneJunctionAttributes = {
	/** Applied to every junction element. */
	"data-pane-junction": "";
	/** The ID of the junction. */
	"data-pane-junction-id": string;
	/** The ID of the group owning the resizer the junction is rendered in. */
	"data-pane-group-id": string;
	/** Whether resizers meet the junction on both sides, or only one. */
	"data-junction-type": "cross" | "tee";
	/** The axis the resizer it is anchored to travels along. */
	"data-junction-axis": "x" | "y";
	/** Which side the resizers that stop here arrive from. Absent on a cross. */
	"data-junction-side"?: "start" | "end";
	/** Whether the junction is being dragged. */
	"data-active"?: "pointer";
	/** Whether the junction is enabled or not. */
	"data-enabled"?: boolean;
};
```
