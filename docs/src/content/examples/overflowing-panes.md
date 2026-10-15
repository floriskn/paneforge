---
title: Overflowing Panes
description: An example of how panes with overflowing content are handled.
section: Examples
---

<script>
	import { OverflowDemo } from '$lib/components/demos'
	import ViewExampleCode from '$lib/components/view-example-code.svelte'
</script>

<OverflowDemo />

<ViewExampleCode href="https://github.com/svecosystem/paneforge/blob/main/sites/docs/src/lib/components/demos/overflow-demo.svelte" />

## Panes do not clip

A pane does not hide what overflows it. It only stops its content from deciding its size, so
the layout still follows the sizes you set — content that is too big spills out rather than
being cut off.

Decide what should happen to your own content, as the example does with `overflow-auto`. If
you want a pane to clip, say so:

```svelte
<Pane defaultSize={50}>
	<div class="h-full overflow-hidden">
		<!-- ... content here-->
	</div>
</Pane>
```

## Anatomy

Here's the high-level structure of the example above:

```svelte
<script lang="ts">
	import { PaneGroup, Pane, PaneResizer } from "paneforge";
</script>

<PaneGroup direction="horizontal">
	<Pane defaultSize={50}>
		<div class="overflow-auto">
			<!-- ... content here-->
		</div>
	</Pane>
	<PaneResizer />
	<Pane defaultSize={50}>
		<PaneGroup direction="vertical">
			<Pane defaultSize={25}>
				<div class="overflow-auto">
					<!-- ... content here-->
				</div>
			</Pane>
			<PaneResizer />
			<Pane defaultSize={75}>
				<div class="overflow-auto">
					<!-- ... content here-->
				</div>
			</Pane>
		</PaneGroup>
	</Pane>
</PaneGroup>
```
