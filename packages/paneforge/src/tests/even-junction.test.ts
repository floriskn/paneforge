import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import EvenJunction from "./even-junction.svelte";
import type { PaneDoubleClick } from "$lib/index.js";

function useStubbedLayout() {
	Element.prototype.getBoundingClientRect = function () {
		const rect = this.getAttribute("data-rect");
		const [left, top, right, bottom] = rect ? rect.split(",").map(Number) : [0, 0, 0, 0];
		return {
			left,
			top,
			right,
			bottom,
			width: right - left,
			height: bottom - top,
			x: left,
			y: top,
			toJSON: () => ({}),
		} as DOMRect;
	};

	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
}

function setup(
	props: {
		doubleClick?: PaneDoubleClick;
		rightDoubleClick?: PaneDoubleClick;
		onRootResizerDoubleClick?: () => void;
	} = {}
) {
	const layouts = { root: [] as number[], left: [] as number[], right: [] as number[] };

	const result = render(EvenJunction, {
		onRootLayout: (layout: number[]) => (layouts.root = layout),
		onLeftLayout: (layout: number[]) => (layouts.left = layout),
		onRightLayout: (layout: number[]) => (layouts.right = layout),
		...props,
	});

	return { ...result, layouts };
}

beforeAll(useStubbedLayout);
afterEach(cleanup);

describe("double clicking a junction", () => {
	it("evens out every group it can move", async () => {
		const { findByTestId, layouts } = setup();

		const junction = await findByTestId("junction");
		await waitFor(() => {
			expect(layouts.root).toEqual([30, 70]);
			expect(layouts.left).toEqual([25, 75]);
			expect(layouts.right).toEqual([20, 80]);
		});

		await fireEvent.dblClick(junction);

		// The junction drags all three, so it evens out all three.
		await waitFor(() => {
			expect(layouts.root).toEqual([50, 50]);
			expect(layouts.left).toEqual([50, 50]);
			expect(layouts.right).toEqual([50, 50]);
		});
	});

	it("leaves out a group that has not asked for it", async () => {
		const { findByTestId, layouts } = setup({ rightDoubleClick: "none" });

		const junction = await findByTestId("junction");
		await waitFor(() => expect(layouts.right).toEqual([20, 80]));

		await fireEvent.dblClick(junction);

		await waitFor(() => {
			expect(layouts.root).toEqual([50, 50]);
			expect(layouts.left).toEqual([50, 50]);
		});
		expect(layouts.right).toEqual([20, 80]);
	});

	it("does nothing when no group has asked for it", async () => {
		const { findByTestId, layouts } = setup({
			doubleClick: "none",
			rightDoubleClick: "none",
		});

		const junction = await findByTestId("junction");
		await waitFor(() => expect(layouts.root).toEqual([30, 70]));

		await fireEvent.dblClick(junction);

		expect(layouts.root).toEqual([30, 70]);
		expect(layouts.left).toEqual([25, 75]);
		expect(layouts.right).toEqual([20, 80]);
	});

	it("lets each group say for itself what a double click means", async () => {
		// One group evens out while another resets, from the same double click: the junction
		// asks each group what it was told to do rather than deciding for all of them.
		const { findByTestId, layouts } = setup({ rightDoubleClick: "reset" });

		const junction = await findByTestId("junction");
		await waitFor(() => expect(layouts.right).toEqual([20, 80]));

		// Dragged away from its defaults, so a reset has somewhere to go back to.
		const rightResizer = await findByTestId("right-resizer");
		await fireEvent.mouseDown(rightResizer, { clientX: 300, clientY: 200 });
		await fireEvent.mouseMove(document.body, { clientX: 300, clientY: 320 });
		await fireEvent.mouseUp(window);
		await waitFor(() => expect(layouts.right[0]).toBeCloseTo(50));

		await fireEvent.dblClick(junction);

		await waitFor(() => {
			expect(layouts.left).toEqual([50, 50]);
			// Back to what it was written with, not to an even split.
			expect(layouts.right).toEqual([20, 80]);
		});
	});

	it("stops at the junction rather than reaching the resizer it sits in", async () => {
		// A junction is rendered inside one of the resizers it drives, which would otherwise
		// see the same double click and even that group out a second time.
		let reachedResizer = false;
		const { findByTestId } = setup({
			onRootResizerDoubleClick: () => (reachedResizer = true),
		});

		const junction = await findByTestId("junction");
		await fireEvent.dblClick(junction);

		expect(reachedResizer).toBe(false);
	});

	it("reaches the resizer it sits in when no group has asked for it", async () => {
		// Nothing to do, so the double click is left alone to be handled elsewhere.
		let reachedResizer = false;
		const { findByTestId } = setup({
			doubleClick: "none",
			rightDoubleClick: "none",
			onRootResizerDoubleClick: () => (reachedResizer = true),
		});

		const junction = await findByTestId("junction");
		await fireEvent.dblClick(junction);

		expect(reachedResizer).toBe(true);
	});
});
