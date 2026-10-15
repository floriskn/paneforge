import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import EvenJunction from "./even-junction.svelte";

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
		evenOnDoubleClick?: boolean;
		rightEvenOnDoubleClick?: boolean;
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
		const { findByTestId, layouts } = setup({ rightEvenOnDoubleClick: false });

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
			evenOnDoubleClick: false,
			rightEvenOnDoubleClick: false,
		});

		const junction = await findByTestId("junction");
		await waitFor(() => expect(layouts.root).toEqual([30, 70]));

		await fireEvent.dblClick(junction);

		expect(layouts.root).toEqual([30, 70]);
		expect(layouts.left).toEqual([25, 75]);
		expect(layouts.right).toEqual([20, 80]);
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
			evenOnDoubleClick: false,
			rightEvenOnDoubleClick: false,
			onRootResizerDoubleClick: () => (reachedResizer = true),
		});

		const junction = await findByTestId("junction");
		await fireEvent.dblClick(junction);

		expect(reachedResizer).toBe(true);
	});
});
