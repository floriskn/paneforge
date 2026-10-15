import type { PaneConstraints } from "../types.js";

/**
 * A utility function that calculates the `aria-valuemax`, `aria-valuemin`,
 * and `aria-valuenow` values for a pane based on its layout and constraints.
 */
export function calculateAriaValues({
	layout,
	paneConstraints,
	pivotIndices,
	total,
}: {
	layout: number[];
	/** Every pane's constraints, in the unit the layout is kept in. */
	paneConstraints: PaneConstraints[];
	pivotIndices: number[];
	/** The size the group has to share out, in the unit the layout is kept in. */
	total: number;
}) {
	let currentMinSize = 0;
	let currentMaxSize = total;
	let totalMinSize = 0;
	let totalMaxSize = 0;

	const firstIndex = pivotIndices[0];

	// A pane's effective min/max sizes also need to account for other pane's sizes.
	for (let i = 0; i < paneConstraints.length; i++) {
		const { maxSize = total, minSize = 0 } = paneConstraints[i];

		if (i === firstIndex) {
			currentMinSize = minSize;
			currentMaxSize = maxSize;
		} else {
			totalMinSize += minSize;
			totalMaxSize += maxSize;
		}
	}

	const valueMax = Math.min(currentMaxSize, total - totalMinSize);
	const valueMin = Math.max(currentMinSize, total - totalMaxSize);

	const valueNow = layout[firstIndex];

	return {
		valueMax,
		valueMin,
		valueNow,
	};
}
