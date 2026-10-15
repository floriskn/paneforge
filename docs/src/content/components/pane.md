---
title: Pane
description: An individual pane within a pane group.
section: Components
---

<script>
	import { PropField, Collapsible } from '@svecodocs/kit';
</script>

The `Pane` component is used to create an individual pane within a `PaneGroup`.

## Sizes

Every size on a pane is read in its own `units`: a share of the group by default, or pixels
when the pane is set to `units="pixels"`. Panes of both kinds can sit in the same group.

A size can also name its own unit, as `minSize="180px"` or `maxSize="60%"`, which is read in
that unit whatever the pane is sized in. A limit in pixels is the same limit wherever the pane
sits, so a pane that takes a share of the group can still refuse to go below the width its
contents need. See [Pixel sizes](/docs/examples/pixel-sizes).

## Props

<PropField name="units" type="'percentage' | 'pixels'" default="its group's units">

The unit this pane is sized in, which is the unit every size on it is read in —
`defaultSize`, `minSize`, `maxSize`, `collapsedSize`, and the sizes reported by `onResize` and
`getSize`.

A `percentage` pane takes a share of the group, so it follows the group as it resizes. A
`pixels` pane is absolute: it keeps its size when the group changes size, and the difference
is taken up by the panes sizing themselves as a share.

</PropField>

<PropField name="collapsedSize" type="number">
The size of the pane when it is in a collapsed state, in the pane's own units.
</PropField>

<PropField name="collapsible" type="boolean">
Whether the pane can be collapsed.
</PropField>

<PropField name="defaultSize" type="number | '180px' | '20%'">

The size the pane starts at, in its own units, or in the unit it names. Leave it off and the
pane takes an even share of whatever the panes that do have one have not claimed, which is how
you say "fill the space left over".

</PropField>

<PropField name="maxSize" type="number | '180px' | '20%'" default="the whole group">
The largest the pane may be, in its own units, or in the unit it names.
</PropField>

<PropField name="minSize" type="number | '180px' | '20%'" default="0">

The smallest the pane may be, in its own units, or in the unit it names.

A limit in pixels does not move with the group, so the same pane has the same smallest size
however deeply it is nested. A limit given as a share moves with the group instead.

It is also applied as a `min-width` or `min-height` on the pane, so flexbox holds it there to
the exact pixel. Collapsible panes are left out of that, since they have to be able to reach
their `collapsedSize`.

</PropField>

<PropField name="order" type="number">
The order of the pane in the group. Useful for maintaining order when conditionally rendering panes.
</PropField>

<PropField name="onCollapse" type="() => void">
A callback that is called when the pane is collapsed.
</PropField>

<PropField name="onExpand" type="() => void">
A callback that is called when the pane is expanded.
</PropField>

<PropField name="onResize" type="(size: number, prevSize: number | undefined) => void">
A callback that is called when the pane is resized.
</PropField>

<PropField name="ref" type="HTMLElement | null">

The underlying DOM element of the pane group. You can `bind` to this prop to get a reference to the element.

</PropField>

<PropField name="this" type="typeof Pane">

Imperative API for the pane group. `bind` to this prop to get access to methods for controlling the pane group.

<Collapsible title="methods">
	<PropField name="collapse" type="() => void">
		Collapse the pane to its minimum size.
	</PropField>
	<PropField name="expand" type="() => void">
		Expand the pane to its previous size.
	</PropField>
	<PropField name="getId" type="() => string">
		Gets the ID of the pane.
	</PropField>
	<PropField name="getSize" type="() => number">
		Gets the size of the pane.
	</PropField>
	<PropField name="isCollapsed" type="() => boolean">
		Checks if the pane is collapsed.
	</PropField>
	<PropField name="isExpanded" type="() => boolean">
		Checks if the pane is expanded.
	</PropField>
	<PropField name="resize" type="(size: number) => void">
		Resize the pane to the specified size.
	</PropField>
</Collapsible>
</PropField>

## Data Attributes

The following data attributes are available for the `Pane` component:

```ts
export type PaneAttributes = {
	/** Applied to every pane element. */
	"data-pane": "";
	/** The ID of the pane. */
	"data-pane-id": string;
	/** The ID of the pane's group. */
	"data-pane-group-id": string;
	/** The unit the pane is sized in. */
	"data-units": "percentage" | "pixels";
};
```
