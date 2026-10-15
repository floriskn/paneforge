import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import PixelGroup from "./pixel-group.svelte";

/** Resize callbacks handed out to `ResizeObserver`, so a test can say the group changed. */
const resizeCallbacks: Array<() => void> = [];

function fireResize() {
	for (const callback of [...resizeCallbacks]) callback();
}

/**
 * jsdom does no layout, so every element carries the box it would have on screen as
 * `data-rect="left,top,right,bottom"`. Pixel groups read `clientWidth` and `offsetWidth`
 * rather than rects, so those have to come from the same place.
 */
function useStubbedLayout() {
	const boxOf = (element: Element) => {
		const rect = element.getAttribute("data-rect");
		const [left, top, right, bottom] = rect ? rect.split(",").map(Number) : [0, 0, 0, 0];
		return { left, top, right, bottom, width: right - left, height: bottom - top };
	};

	Element.prototype.getBoundingClientRect = function () {
		const box = boxOf(this);
		return { ...box, x: box.left, y: box.top, toJSON: () => ({}) } as DOMRect;
	};

	for (const [property, side] of [
		["clientWidth", "width"],
		["offsetWidth", "width"],
		["clientHeight", "height"],
		["offsetHeight", "height"],
	] as const) {
		Object.defineProperty(HTMLElement.prototype, property, {
			configurable: true,
			get() {
				return boxOf(this)[side];
			},
		});
	}

	globalThis.ResizeObserver = class {
		constructor(callback: () => void) {
			resizeCallbacks.push(callback);
		}
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
}

function setup(props: { groupRect?: string } = {}) {
	let layout: number[] = [];
	const result = render(PixelGroup, {
		onLayout: (next: number[]) => (layout = next),
		...props,
	});

	return { ...result, layout: () => layout };
}

/** The size a pane was actually given, read off its `flex-basis`. */
function basisOf(element: HTMLElement) {
	return Number.parseFloat(element.style.flexBasis);
}

beforeAll(useStubbedLayout);

afterEach(() => {
	resizeCallbacks.length = 0;
	cleanup();
});

describe("a group measured in pixels", () => {
	it("shares out the space left over after the resizers", async () => {
		const { findByTestId, layout } = setup();

		const sidebar = await findByTestId("sidebar");
		const content = await findByTestId("content");

		// 600px of group, less the 4px resizer, is 596px for the panes.
		await waitFor(() => expect(layout()).toEqual([200, 396]));
		expect(basisOf(sidebar)).toBe(200);
		expect(basisOf(content)).toBe(396);
		// Absolute sizes do not grow to fill, unlike shares.
		expect(sidebar.style.flexGrow).toBe("0");
	});

	it("resizes by the distance actually dragged", async () => {
		const { findByTestId, layout } = setup();

		const resizer = await findByTestId("resizer");
		await waitFor(() => expect(layout()).toEqual([200, 396]));

		await fireEvent.mouseDown(resizer, { clientX: 202, clientY: 0 });
		await fireEvent.mouseMove(document.body, { clientX: 252, clientY: 0 });

		// 50px of pointer movement is 50px of pane, with no conversion in between.
		await waitFor(() => expect(layout()).toEqual([250, 346]));

		await fireEvent.mouseUp(window);
	});

	it("holds a pane at its pixel maximum", async () => {
		const { findByTestId, layout } = setup();

		const resizer = await findByTestId("resizer");
		await waitFor(() => expect(layout()).toEqual([200, 396]));

		await fireEvent.mouseDown(resizer, { clientX: 202, clientY: 0 });
		await fireEvent.mouseMove(document.body, { clientX: 602, clientY: 0 });

		// maxSize is 300, so the sidebar stops there however far the pointer goes.
		await waitFor(() => expect(layout()).toEqual([300, 296]));

		await fireEvent.mouseUp(window);
	});

	it("holds a pane at its pixel minimum", async () => {
		const { findByTestId, layout } = setup();

		const resizer = await findByTestId("resizer");
		await waitFor(() => expect(layout()).toEqual([200, 396]));

		await fireEvent.mouseDown(resizer, { clientX: 202, clientY: 0 });
		await fireEvent.mouseMove(document.body, { clientX: 0, clientY: 0 });

		await waitFor(() => expect(layout()).toEqual([100, 496]));

		await fireEvent.mouseUp(window);
	});

	it("keeps pane sizes when the group shrinks, taking it out of the last pane", async () => {
		const { container, findByTestId, layout } = setup();

		await findByTestId("sidebar");
		await waitFor(() => expect(layout()).toEqual([200, 396]));

		const group = container.querySelector<HTMLElement>("[data-pane-group]");
		group?.setAttribute("data-rect", "0,0,500,400");
		fireResize();

		// The sidebar was given 200px and keeps it; the 100px comes off the content pane.
		await waitFor(() => expect(layout()).toEqual([200, 296]));
	});

	it("gives space back to the last pane when the group grows", async () => {
		const { container, findByTestId, layout } = setup();

		await findByTestId("sidebar");
		await waitFor(() => expect(layout()).toEqual([200, 396]));

		const group = container.querySelector<HTMLElement>("[data-pane-group]");
		group?.setAttribute("data-rect", "0,0,800,400");
		fireResize();

		await waitFor(() => expect(layout()).toEqual([200, 596]));
	});

	it("says which unit it is measured in", async () => {
		const { container, findByTestId } = setup();

		await findByTestId("sidebar");

		expect(container.querySelector("[data-pane-group]")?.getAttribute("data-units")).toBe(
			"pixels"
		);
	});
});
