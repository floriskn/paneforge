import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import EvenGroup from "./even-group.svelte";
import type { PaneUnits } from "$lib/index.js";

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
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
}

function setup(
	props: {
		units?: PaneUnits;
		evenOnDoubleClick?: boolean;
		thirdMinSize?: number;
	} = {}
) {
	let layout: number[] = [];
	const result = render(EvenGroup, {
		onLayout: (next: number[]) => (layout = next),
		...props,
	});

	return { ...result, layout: () => layout };
}

beforeAll(useStubbedLayout);
afterEach(cleanup);

describe("double clicking a resize handle", () => {
	it("gives every pane the same share", async () => {
		const { findByTestId, layout } = setup();

		const resizer = await findByTestId("first");
		await waitFor(() => expect(layout()).toEqual([20, 30, 50]));

		await fireEvent.dblClick(resizer);

		await waitFor(() => {
			for (const size of layout()) expect(size).toBeCloseTo(100 / 3);
		});
	});

	it("gives every pane the same number of pixels", async () => {
		const { findByTestId, layout } = setup({ units: "pixels" });

		const resizer = await findByTestId("first");
		// 600px of group, less two 4px resizers, is 592px for the panes.
		await waitFor(() => expect(layout()).toEqual([100, 200, 292]));

		await fireEvent.dblClick(resizer);

		await waitFor(() => {
			for (const size of layout()) expect(size).toBeCloseTo(592 / 3);
		});
	});

	it("works from any handle in the group", async () => {
		const { findByTestId, layout } = setup();

		const resizer = await findByTestId("second");
		await waitFor(() => expect(layout()).toEqual([20, 30, 50]));

		await fireEvent.dblClick(resizer);

		await waitFor(() => expect(layout()[0]).toBeCloseTo(100 / 3));
	});

	it("holds a pane at its own limit and shares the rest out", async () => {
		// An even third would be 33.3, but this pane will not go below 50.
		const { findByTestId, layout } = setup({ thirdMinSize: 50 });

		const resizer = await findByTestId("first");
		await fireEvent.dblClick(resizer);

		await waitFor(() => {
			const [one, two, three] = layout();
			expect(three).toBeCloseTo(50);
			expect(one + two).toBeCloseTo(50);
			expect(one + two + three).toBeCloseTo(100);
		});
	});

	it("does nothing unless the group asks for it", async () => {
		const { findByTestId, layout } = setup({ evenOnDoubleClick: false });

		const resizer = await findByTestId("first");
		await waitFor(() => expect(layout()).toEqual([20, 30, 50]));

		await fireEvent.dblClick(resizer);

		// Still exactly as it started.
		await waitFor(() => expect(layout()).toEqual([20, 30, 50]));
	});
});
