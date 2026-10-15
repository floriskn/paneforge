<script lang="ts">
	import { box } from "svelte-toolbelt";
	import type { PaneJunctionsProps } from "./types.js";
	import { noop } from "$lib/internal/helpers.js";
	import { PaneJunctionsState } from "$lib/paneforge.svelte.js";

	let {
		disabled = false,
		tolerance = 4,
		crossTolerance = 0.5,
		onDraggingChange = noop,
		child,
		children,
		...restProps
	}: PaneJunctionsProps = $props();

	const junctionsState = PaneJunctionsState.create({
		disabled: box.with(() => disabled),
		tolerance: box.with(() => tolerance),
		crossTolerance: box.with(() => crossTolerance),
		onDraggingChange: box.with(() => onDraggingChange),
		child: box.with(() => child),
		children: box.with(() => children),
		restProps: box.with(() => restProps),
	});

	export const getJunctions = junctionsState.api.getJunctions;
</script>

<!--
	Nothing is rendered here. Each junction is handed to the group that hosts it and rendered
	there, so this can sit anywhere inside the group it scopes.
-->
