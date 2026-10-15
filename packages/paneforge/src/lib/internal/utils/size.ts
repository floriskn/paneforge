import type { PaneSize, PaneSizeValue, PaneUnits } from "../types.js";

const WITH_UNITS = /^\s*(-?\d*\.?\d+)\s*(px|%)\s*$/;

/**
 * Settles what unit a size on a pane is to be read in.
 *
 * A bare number is read in the pane's own units, so a pane sizing itself as a share is bounded
 * by shares. A size that names its unit is read in that one instead, which is how a pane that
 * takes a share of the group can still be held to a minimum in pixels — a limit that does not
 * change with the size of what the pane happens to sit inside.
 */
export function resolvePaneSize(
	size: PaneSize | undefined,
	fallback: PaneUnits
): PaneSizeValue | undefined {
	if (size == null) return undefined;

	if (typeof size === "number") {
		return Number.isFinite(size) ? { value: size, units: fallback } : undefined;
	}

	const match = WITH_UNITS.exec(size);
	if (!match) return undefined;

	return {
		value: Number.parseFloat(match[1]),
		units: match[2] === "px" ? "pixels" : "percentage",
	};
}
