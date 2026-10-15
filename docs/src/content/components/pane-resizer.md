---
title: PaneResizer
description: A draggable handle between two panes that allows the user to resize them.
section: Components
---

<script>
	import { PropField, Collapsible } from '@svecodocs/kit'
</script>

The `PaneResizer` component is used to create a draggable handle between two panes that allows the user to resize them.

## Usage

```svelte {7}
<script lang="ts">
	import { PaneGroup, Pane, PaneResizer } from "svelte-pane";
</script>

<PaneGroup direction="horizontal">
	<Pane defaultSize={50}>Pane 1</Pane>
	<PaneResizer />
	<Pane defaultSize={50}>Pane 2</Pane>
</PaneGroup>
```

## Props

<PropField name="disabled" type="boolean" default="false">
Whether the resize handle is disabled.
</PropField>

<PropField name="onDraggingChange" type="(isDragging: boolean) => void">
A callback that is called when the resize handle's dragging state changes.
</PropField>

<PropField name="ref" type="HTMLElement | null">

The underlying DOM element of the pane group. You can `bind` to this prop to get a reference to the element.

</PropField>

## Child Snippet

The `child` snippet lets you render your own element for the resize handle. It receives the
handle's props, along with a `junctions` snippet holding any
[junctions](https://paneforge.com/docs/components/pane-junctions) anchored to this resizer.
Render it inside your element so they are positioned correctly — you can leave it out if you
aren't using `PaneJunctions`.

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

It also receives `getLinkedIds()`, which returns the ids of the resizers that would be dragged
along with this one because they line up with it — see
[`align`](/docs/examples/aligned-grids). Dividers are linked by where they currently are, so
it is measured when called rather than held onto:

```svelte
<PaneResizer>
	{#snippet child({ props, junctions, getLinkedIds })}
		<!-- Dividers that move as one, lit as one. -->
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

## Data Attributes

The following data attributes are available for the `PaneResizer` component:

```ts
export type PaneResizerAttributes = {
	/** The direction of the pane group the handle belongs to. */
	"data-direction": "horizontal" | "vertical";
	/** The ID of the pane group the handle belongs to. */
	"data-pane-group-id": string;
	/** Whether the resize handle is active or not. */
	"data-active"?: "pointer" | "keyboard";
	/** Whether the resize handle is enabled or not. */
	"data-enabled"?: boolean;
	/** The ID of the resize handle. */
	"data-pane-resizer-id": string;
	/** Present on all resizer elements */
	"data-pane-resizer": "";
};
```
