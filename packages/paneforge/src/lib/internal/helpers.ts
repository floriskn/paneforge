import type { PaneState } from "$lib/paneforge.svelte.js";
import type { DOMContext } from "svelte-toolbelt";
import type { Direction, DragState, PaneConstraints, PaneUnits, ResizeEvent } from "./types.js";
import { calculateAriaValues } from "./utils/aria.js";
import { assert } from "./utils/assert.js";
import { areNumbersAlmostEqual } from "./utils/compare.js";
import { isBrowser, isHTMLElement, isKeyDown, isMouseEvent, isTouchEvent } from "./utils/is.js";
import { resizePane } from "./utils/resize.js";

export function noop() {}

interface UpdateResizeHandleAriaValuesOpts {
	groupId: string;
	layout: number[];
	panesArray: PaneState[];
	paneConstraints: PaneConstraints[];
	domContext: DOMContext;
	total: number;
}

export function updateResizeHandleAriaValues({
	groupId,
	layout,
	panesArray,
	paneConstraints,
	domContext,
	total,
}: UpdateResizeHandleAriaValuesOpts) {
	const resizeHandleElements = getResizeHandleElementsForGroup(groupId, domContext);

	for (let index = 0; index < panesArray.length - 1; index++) {
		const { valueMax, valueMin, valueNow } = calculateAriaValues({
			layout,
			paneConstraints,
			pivotIndices: [index, index + 1],
			total,
		});

		const resizeHandleEl = resizeHandleElements[index];

		if (isHTMLElement(resizeHandleEl)) {
			const paneData = panesArray[index];
			resizeHandleEl.setAttribute("aria-controls", paneData.opts.id.current);
			resizeHandleEl.setAttribute("aria-valuemax", `${Math.round(valueMax)}`);
			resizeHandleEl.setAttribute("aria-valuemin", `${Math.round(valueMin)}`);
			resizeHandleEl.setAttribute(
				"aria-valuenow",
				valueNow != null ? `${Math.round(valueNow)}` : ""
			);
		}
	}

	return () => {
		for (const el of resizeHandleElements) {
			el.removeAttribute("aria-controls");
			el.removeAttribute("aria-valuemax");
			el.removeAttribute("aria-valuemin");
			el.removeAttribute("aria-valuenow");
		}
	};
}

export function getResizeHandleElementsForGroup(
	groupId: string,
	domContext: DOMContext
): HTMLElement[] {
	if (!isBrowser) return [];
	return Array.from(
		domContext.querySelectorAll(
			`[data-pane-resizer-id][data-pane-group-id="${groupId}"]`
		) as NodeListOf<HTMLElement>
	);
}

interface GetResizeHandleElementIndexOpts {
	groupId: string;
	id: string;
	domContext: DOMContext;
}

export function getResizeHandleElementIndex({
	groupId,
	id,
	domContext,
}: GetResizeHandleElementIndexOpts): number | null {
	if (!isBrowser) return null;
	const handles = getResizeHandleElementsForGroup(groupId, domContext);
	const index = handles.findIndex((handle) => handle.getAttribute("data-pane-resizer-id") === id);
	return index ?? null;
}

type GetPivotIndicesOpts = {
	groupId: string;
	dragHandleId: string;
	domContext: DOMContext;
};

export function getPivotIndices({
	groupId,
	dragHandleId,
	domContext,
}: GetPivotIndicesOpts): [indexBefore: number, indexAfter: number] {
	const index = getResizeHandleElementIndex({
		groupId,
		id: dragHandleId,
		domContext: domContext,
	});

	return index != null ? [index, index + 1] : [-1, -1];
}

/**
 * A pane's size and constraints, together with the indices a resize pivots around.
 *
 * The constraints have to be the group's own, in the unit its layout is kept in, so that the
 * size handed back can be compared with them.
 */
export function paneDataHelper(
	panesArray: PaneState[],
	paneConstraintsArray: PaneConstraints[],
	pane: PaneState,
	layout: number[]
) {
	const paneIndex = findPaneDataIndex(panesArray, pane);
	const paneConstraints = paneConstraintsArray[paneIndex];

	const isLastPane = paneIndex === panesArray.length - 1;
	const pivotIndices = isLastPane ? [paneIndex - 1, paneIndex] : [paneIndex, paneIndex + 1];

	const paneSize = layout[paneIndex];

	return {
		...paneConstraints,
		paneSize,
		pivotIndices,
	};
}

export function findPaneDataIndex(panesArray: readonly PaneState[], pane: PaneState) {
	return panesArray.findIndex(
		(prevPaneData) => prevPaneData.opts.id.current === pane.opts.id.current
	);
}

/** The layout must be in each pane's own units, which is what callbacks report. */
export function callPaneCallbacks(
	panesArray: PaneState[],
	layout: number[],
	paneIdToLastNotifiedSizeMap: Record<string, number>
) {
	for (let index = 0; index < layout.length; index++) {
		const size = layout[index];
		const paneData = panesArray[index];
		assert(paneData);

		const { collapsedSize = 0, collapsible } = paneData.constraints;

		const lastNotifiedSize = paneIdToLastNotifiedSizeMap[paneData.opts.id.current];
		// invert the logic from below
		if (!(lastNotifiedSize == null || size !== lastNotifiedSize)) continue;
		paneIdToLastNotifiedSizeMap[paneData.opts.id.current] = size;

		const { onCollapse, onExpand, onResize } = paneData.callbacks;

		onResize?.(size, lastNotifiedSize);

		if (collapsible && (onCollapse || onExpand)) {
			if (
				onExpand &&
				(lastNotifiedSize == null || lastNotifiedSize === collapsedSize) &&
				size !== collapsedSize
			) {
				onExpand();
			}

			if (
				onCollapse &&
				(lastNotifiedSize == null || lastNotifiedSize !== collapsedSize) &&
				size === collapsedSize
			) {
				onCollapse();
			}
		}
	}
}

/** All sizes must be in the unit the layout is kept in. */
export function getUnsafeDefaultLayout({
	paneConstraints: paneConstraintsArray,
	total,
}: {
	paneConstraints: PaneConstraints[];
	total: number;
}): number[] {
	const layout = Array<number>(paneConstraintsArray.length);

	let numPanesWithSizes = 0;
	let remainingSize = total;

	// Distribute default sizes first
	for (let index = 0; index < paneConstraintsArray.length; index++) {
		const paneConstraints = paneConstraintsArray[index];
		assert(paneConstraints);
		const { defaultSize } = paneConstraints;

		if (defaultSize != null) {
			numPanesWithSizes++;
			layout[index] = defaultSize;
			remainingSize -= defaultSize;
		}
	}

	// Remaining size should be distributed evenly between panes without default sizes
	for (let index = 0; index < paneConstraintsArray.length; index++) {
		const paneConstraints = paneConstraintsArray[index];
		assert(paneConstraints);
		const { defaultSize } = paneConstraints;

		if (defaultSize != null) {
			continue;
		}

		const numRemainingPanes = paneConstraintsArray.length - numPanesWithSizes;
		const size = remainingSize / numRemainingPanes;

		numPanesWithSizes++;
		layout[index] = size;
		remainingSize -= size;
	}

	return layout;
}

/** All sizes must be in the unit the layout is kept in. */
export function validatePaneGroupLayout({
	layout: prevLayout,
	paneConstraints,
	total,
	absolute,
}: {
	layout: number[];
	paneConstraints: PaneConstraints[];
	total: number;
	/**
	 * Which panes hold an absolute size. A layout that does not add up is rescaled to fit,
	 * and these are left out of that so they keep the size they were given — only the panes
	 * sizing themselves as a share of the group are rescaled.
	 */
	absolute?: boolean[];
}): number[] {
	const nextLayout = [...prevLayout];
	const nextLayoutTotalSize = nextLayout.reduce(
		(accumulated, current) => accumulated + current,
		0
	);

	// Validate layout expectations
	if (nextLayout.length !== paneConstraints.length) {
		throw new Error(
			`Invalid ${paneConstraints.length} pane layout: ${nextLayout
				.map((size) => `${size}%`)
				.join(", ")}`
		);
	} else if (!areNumbersAlmostEqual(nextLayoutTotalSize, total)) {
		const shares: number[] = [];
		let sharedSize = 0;

		for (let index = 0; index < nextLayout.length; index++) {
			if (absolute?.[index]) continue;
			shares.push(index);
			sharedSize += nextLayout[index] ?? 0;
		}

		// What the panes sizing themselves as a share have to add up to, once the absolute
		// ones have taken theirs.
		const sharedTarget = total - (nextLayoutTotalSize - sharedSize);

		if (shares.length > 0 && sharedSize > 0 && sharedTarget > 0) {
			for (const index of shares) {
				const unsafeSize = nextLayout[index];
				assert(unsafeSize != null);
				nextLayout[index] = (sharedTarget / sharedSize) * unsafeSize;
			}
		} else {
			// Nothing can give way on its own, so everything is rescaled.
			for (let index = 0; index < paneConstraints.length; index++) {
				const unsafeSize = nextLayout[index];
				assert(unsafeSize != null);
				const safeSize = (total / nextLayoutTotalSize) * unsafeSize;
				nextLayout[index] = safeSize;
			}
		}
	}

	let remainingSize = 0;

	// First pass: Validate the proposed layout given each pane's constraints
	for (let index = 0; index < paneConstraints.length; index++) {
		const unsafeSize = nextLayout[index];
		assert(unsafeSize != null);

		const safeSize = resizePane({
			paneConstraints,
			paneIndex: index,
			initialSize: unsafeSize,
			total,
		});

		if (unsafeSize !== safeSize) {
			remainingSize += unsafeSize - safeSize;

			nextLayout[index] = safeSize;
		}
	}

	// If there is additional, left over space, assign it to any pane(s) that permits it
	// (It's not worth taking multiple additional passes to evenly distribute)
	if (!areNumbersAlmostEqual(remainingSize, 0)) {
		for (let index = 0; index < paneConstraints.length; index++) {
			const prevSize = nextLayout[index];
			assert(prevSize != null);
			const unsafeSize = prevSize + remainingSize;
			const safeSize = resizePane({
				paneConstraints,
				paneIndex: index,
				initialSize: unsafeSize,
				total,
			});

			if (prevSize !== safeSize) {
				remainingSize -= safeSize - prevSize;
				nextLayout[index] = safeSize;

				// Once we've used up the remainder, bail
				if (areNumbersAlmostEqual(remainingSize, 0)) {
					break;
				}
			}
		}
	}

	return nextLayout;
}

/**
 * Fits a layout to a new total without rescaling it.
 *
 * A pane sizing itself as a share of the group follows the group as it changes size; a pane
 * given an absolute size keeps that size. So the difference is offered first to the panes
 * sizing themselves as a share, split between them in proportion to what they already have,
 * which leaves their shares of one another untouched.
 *
 * Whatever they cannot take is then taken from the last pane backwards, so the panes at the
 * start — the fixed sidebar, usually — are the last to give way, and only do so once nothing
 * else can. If no pane can absorb the rest, the layout is rescaled as a last resort so the
 * panes still fill the group.
 */
export function fitLayoutToTotal({
	layout: prevLayout,
	paneConstraints,
	total,
	absolute,
}: {
	layout: number[];
	paneConstraints: PaneConstraints[];
	total: number;
	/** Which panes hold an absolute size, and so are the last to be asked to give way. */
	absolute?: boolean[];
}): number[] {
	if (prevLayout.length === 0) return prevLayout;

	const currentTotal = prevLayout.reduce((accumulated, size) => accumulated + size, 0);
	let remaining = total - currentTotal;

	if (areNumbersAlmostEqual(remaining, 0)) return prevLayout;

	const nextLayout = [...prevLayout];

	// The panes that follow the group, and what they currently add up to, so the change can
	// be split between them in proportion.
	const shares: number[] = [];
	let sharedSize = 0;

	for (let index = 0; index < nextLayout.length; index++) {
		if (absolute?.[index]) continue;
		shares.push(index);
		sharedSize += nextLayout[index] ?? 0;
	}

	if (shares.length > 0) {
		const toShare = remaining;

		for (const index of shares) {
			const prevSize = nextLayout[index];
			assert(prevSize != null);

			const portion = sharedSize > 0 ? prevSize / sharedSize : 1 / shares.length;
			const safeSize = resizePane({
				paneConstraints,
				paneIndex: index,
				initialSize: prevSize + toShare * portion,
				total,
			});

			remaining -= safeSize - prevSize;
			nextLayout[index] = safeSize;
		}

		if (areNumbersAlmostEqual(remaining, 0)) return nextLayout;
	}

	for (let index = nextLayout.length - 1; index >= 0; index--) {
		const prevSize = nextLayout[index];
		assert(prevSize != null);

		const safeSize = resizePane({
			paneConstraints,
			paneIndex: index,
			initialSize: prevSize + remaining,
			total,
		});

		remaining -= safeSize - prevSize;
		nextLayout[index] = safeSize;

		if (areNumbersAlmostEqual(remaining, 0)) return nextLayout;
	}

	return validatePaneGroupLayout({ layout: nextLayout, paneConstraints, total, absolute });
}

export function getPaneGroupElement(id: string, domContext: DOMContext): HTMLElement | null {
	if (!isBrowser) return null;
	const element = domContext.querySelector(
		`[data-pane-group][data-pane-group-id="${id}"]`
	) as HTMLElement;
	if (element) return element;
	return null;
}

export function getResizeHandleElement(id: string, domContext: DOMContext): HTMLElement | null {
	if (!isBrowser) return null;
	const element = domContext.querySelector(`[data-pane-resizer-id="${id}"]`) as HTMLElement;
	if (element) return element;
	return null;
}

interface GetDragOffsetOpts {
	event: ResizeEvent;
	dragHandleId: string;
	dir: Direction;
	initialDragState: DragState;
	domContext: DOMContext;
	units: PaneUnits;
}

/** The distance dragged, in the unit the group keeps its layout in. */
export function getDragOffset({
	event,
	dragHandleId,
	dir,
	initialDragState,
	domContext,
	units,
}: GetDragOffsetOpts): number {
	const isHorizontal = dir === "horizontal";

	const handleElement = getResizeHandleElement(dragHandleId, domContext);
	assert(handleElement);

	const groupId = handleElement.getAttribute("data-pane-group-id");
	assert(groupId);

	const { initialCursorPosition } = initialDragState;

	const cursorPosition = getResizeEventCursorPosition(dir, event);
	const offsetPixels = cursorPosition - initialCursorPosition;

	// A pixel layout already measures in the unit the pointer moves in.
	if (units === "pixels") return offsetPixels;

	const groupElement = getPaneGroupElement(groupId, domContext);
	assert(groupElement);

	const groupRect = groupElement.getBoundingClientRect();
	const groupSizeInPixels = isHorizontal ? groupRect.width : groupRect.height;

	return (offsetPixels / groupSizeInPixels) * 100;
}

interface GetDeltaOpts {
	event: ResizeEvent;
	dragHandleId: string;
	dir: Direction;
	initialDragState: DragState | null;
	keyboardResizeBy: number | null;
	domContext: DOMContext;
	units: PaneUnits;
	total: number;
}

// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementX
/** The requested change in size, in the unit the group keeps its layout in. */
export function getDelta({
	event,
	dragHandleId,
	dir,
	initialDragState,
	keyboardResizeBy,
	domContext,
	units,
	total,
}: GetDeltaOpts): number {
	if (isKeyDown(event)) {
		const isHorizontal = dir === "horizontal";

		let delta = 0;
		if (event.shiftKey) {
			delta = total;
		} else if (keyboardResizeBy != null) {
			delta = keyboardResizeBy;
		} else {
			delta = 10;
		}

		let movement = 0;
		switch (event.key) {
			case "ArrowDown":
				movement = isHorizontal ? 0 : delta;
				break;
			case "ArrowLeft":
				movement = isHorizontal ? -delta : 0;
				break;
			case "ArrowRight":
				movement = isHorizontal ? delta : 0;
				break;
			case "ArrowUp":
				movement = isHorizontal ? 0 : -delta;
				break;
			case "End":
				movement = total;
				break;
			case "Home":
				movement = -total;
				break;
		}

		return movement;
	} else {
		if (initialDragState == null) return 0;

		return getDragOffset({
			event,
			dragHandleId,
			dir,
			initialDragState,
			domContext: domContext,
			units,
		});
	}
}

export function getResizeEventCursorPosition(dir: Direction, e: ResizeEvent): number {
	const isHorizontal = dir === "horizontal";

	if (isMouseEvent(e)) {
		return isHorizontal ? e.clientX : e.clientY;
	} else if (isTouchEvent(e)) {
		const firstTouch = e.touches[0];
		assert(firstTouch);
		return isHorizontal ? firstTouch.screenX : firstTouch.screenY;
	} else {
		throw new Error(`Unsupported event type "${e.type}"`);
	}
}

interface GetResizeHandlePaneIdsOpts {
	groupId: string;
	handleId: string;
	panesArray: PaneState[];
	domContext: DOMContext;
}

export function getResizeHandlePaneIds({
	groupId,
	handleId,
	panesArray,
	domContext,
}: GetResizeHandlePaneIdsOpts): [idBefore: string | null, idAfter: string | null] {
	const handle = getResizeHandleElement(handleId, domContext);
	const handles = getResizeHandleElementsForGroup(groupId, domContext);
	const index = handle ? handles.indexOf(handle) : -1;

	const idBefore: string | null = panesArray[index]?.opts.id.current ?? null;
	const idAfter: string | null = panesArray[index + 1]?.opts.id.current ?? null;

	return [idBefore, idAfter];
}
