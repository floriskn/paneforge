import type { Direction, DragState, PaneUnits } from "../types.js";

type CursorState =
	| "horizontal"
	| "horizontal-max"
	| "horizontal-min"
	| "vertical"
	| "vertical-max"
	| "vertical-min"
	| "junction";

/* Global cursor state */
let currentState: CursorState | null = null;

/* Global cursor element */
let element: HTMLStyleElement | null = null;

/**
 * Returns the cursor style for a given cursor state.
 */
export function getCursorStyle(state: CursorState): string {
	switch (state) {
		case "horizontal":
			return "ew-resize";
		case "horizontal-max":
			return "w-resize";
		case "horizontal-min":
			return "e-resize";
		case "vertical":
			return "ns-resize";
		case "vertical-max":
			return "n-resize";
		case "vertical-min":
			return "s-resize";
		case "junction":
			return "move";
	}
}

/**
 * Resets the global cursor style to the default.
 */
export function resetGlobalCursorStyle() {
	if (element === null) return;

	document.head.removeChild(element);

	currentState = null;
	element = null;
}

/**
 * Sets the global cursor style to the given state.
 */
export function setGlobalCursorStyle(state: CursorState, doc: Document) {
	if (currentState === state) return;

	currentState = state;

	const style = getCursorStyle(state);

	if (element === null) {
		element = doc.createElement("style");
		doc.head.appendChild(element);
	}

	element.innerHTML = `*{cursor: ${style}!important;}`;
}

/**
 * Computes the flexbox style for a pane given its layout and drag state.
 *
 * The two units are the two ways flex can size a child, which is what keeps them able to
 * share a group: an absolute size is a `flex-basis`, and a share of the group is a
 * `flex-grow` weight. Basis is taken out of the group first, so the panes sizing themselves
 * as a share grow into whatever is left over — and absorb any fraction of a pixel that
 * rounding leaves behind.
 *
 * A limit written in pixels is handed to flex as well, as a `min-` or `max-` size along the
 * axis the pane is laid out on. Flex holds an item at those exactly, where a share has to
 * survive a round trip through a percentage and lands a fraction of a pixel out.
 *
 * Sizes must be in the pane's own units.
 */
export function computePaneFlexBoxStyle({
	size,
	defaultSize,
	dragState,
	units,
	paneCount,
	direction,
	minPixels,
	maxPixels,
	decimals = 4,
}: {
	/** The pane's size in `units`, or nothing if the group has yet to lay anything out. */
	size: number | undefined;
	defaultSize: number | undefined;
	dragState: DragState | null;
	units: PaneUnits;
	paneCount: number;
	/** Which way the group runs, and so which axis the pane is sized along. */
	direction?: Direction;
	/** The pane's smallest size in pixels, where it has one. */
	minPixels?: number;
	/** The pane's largest size in pixels, where it has one. */
	maxPixels?: number;
	/**
	 * How many decimal places a grow weight is written to. Enough that a pane lands within a
	 * thousandth of a pixel of its share, and never so few digits that the number reaches for
	 * an exponent, which CSS cannot read.
	 */
	decimals?: number;
}): Record<string, unknown> {
	const along = direction === "vertical" ? "Height" : "Width";
	// Disable pointer events inside of a pane during resize. This avoids edge cases like
	// nested iframes. Left out entirely when not dragging, rather than written as
	// `undefined`, which would ship an invalid declaration in server-rendered markup.
	const shared = {
		flexShrink: 1,
		// Without this, pane sizes may be unintentionally overridden by their content
		overflow: "hidden",
		...(minPixels != null ? { [`min${along}`]: `${minPixels}px` } : {}),
		...(maxPixels != null ? { [`max${along}`]: `${maxPixels}px` } : {}),
		...(dragState !== null ? { pointerEvents: "none" } : {}),
	};

	if (units === "pixels") {
		const basis = size ?? defaultSize;

		// Before the group has measured itself there are no pixel sizes to lay out with. A
		// pane with no size of its own is the one meant to take up the slack, so let it fill
		// until the real sizes arrive rather than starting at nothing.
		if (basis == null) return { flexBasis: 0, flexGrow: 1, ...shared };

		// An absolute size goes on flex-basis and the pane is told not to grow. It may still
		// shrink, so a group that is briefly too small for its panes degrades by squeezing
		// them rather than overflowing.
		return { flexBasis: `${basis}px`, flexGrow: 0, ...shared };
	}

	let flexGrow;
	if (size == null) {
		// Initial render (before panes have registered themselves)
		// To support server rendering, fallback to default size
		flexGrow = defaultSize ?? "1";
	} else if (paneCount === 1) {
		//  Single pane group should always fill full width/height
		flexGrow = "1";
	} else {
		flexGrow = size.toFixed(decimals);
	}

	return { flexBasis: 0, flexGrow, ...shared };
}
