import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import QuadGrid from "./quad-grid.svelte";

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

function setup(props: { align?: boolean; outer?: "horizontal" | "vertical" } = {}) {
	const layouts = { first: [] as number[], second: [] as number[] };

	const result = render(QuadGrid, {
		onFirst: (layout: number[]) => (layouts.first = layout),
		onSecond: (layout: number[]) => (layouts.second = layout),
		...props,
	});

	return { ...result, layouts };
}

beforeAll(useStubbedLayout);
afterEach(cleanup);

describe.each(["horizontal", "vertical"] as const)("a 2x2 grid, %s outer group", (outer) => {
	it("starts with both halves split down the middle", async () => {
		const { findByTestId, layouts } = setup({ outer });

		await findByTestId("a");

		await waitFor(() => {
			expect(layouts.first).toEqual([50, 50]);
			expect(layouts.second).toEqual([50, 50]);
		});
	});

	it("moves the other half when one divider is dragged", async () => {
		const { findByTestId, layouts } = setup({ outer });

		const bar = await findByTestId("first-bar");
		await waitFor(() => expect(layouts.first).toEqual([50, 50]));

		// The dividers sit at 200 in a 400px box, so 40px is 10%.
		await fireEvent.mouseDown(bar, { clientX: 200, clientY: 200 });
		await fireEvent.mouseMove(document.body, { clientX: 240, clientY: 240 });

		await waitFor(() => {
			expect(layouts.first[0]).toBeCloseTo(60);
			expect(layouts.second).toEqual(layouts.first);
		});

		await fireEvent.mouseUp(window);
	});

	it("leaves the halves alone when not aligned", async () => {
		const { findByTestId, layouts } = setup({ outer, align: false });

		const bar = await findByTestId("first-bar");
		await waitFor(() => expect(layouts.first).toEqual([50, 50]));

		await fireEvent.mouseDown(bar, { clientX: 200, clientY: 200 });
		await fireEvent.mouseMove(document.body, { clientX: 240, clientY: 240 });

		await waitFor(() => expect(layouts.first[0]).toBeCloseTo(60));
		expect(layouts.second).toEqual([50, 50]);

		await fireEvent.mouseUp(window);
	});

	it("evens both halves out from a double click", async () => {
		const { findByTestId, layouts } = setup({ outer });

		const bar = await findByTestId("first-bar");
		await waitFor(() => expect(layouts.first).toEqual([50, 50]));

		await fireEvent.mouseDown(bar, { clientX: 200, clientY: 200 });
		await fireEvent.mouseMove(document.body, { clientX: 260, clientY: 260 });
		await fireEvent.mouseUp(window);
		await waitFor(() => expect(layouts.first[0]).toBeCloseTo(65));

		await fireEvent.dblClick(bar);

		await waitFor(() => {
			expect(layouts.first[0]).toBeCloseTo(50);
			expect(layouts.second[0]).toBeCloseTo(50);
		});
	});

	it("forms one cross in the middle while the dividers line up", async () => {
		const { findAllByTestId, findByTestId } = setup({ outer, align: false });

		await findByTestId("a");

		const junctions = await findAllByTestId("junction");
		const middle = junctions.find(
			(junction) => junction.getAttribute("data-junction-type") === "cross"
		);

		expect(middle).toBeDefined();
	});

	it("moves both halves and the outer divider from the middle cross", async () => {
		// Independent dividers, but the corner where they meet drives all of them.
		const { findAllByTestId, findByTestId, layouts } = setup({ outer, align: false });

		await findByTestId("a");
		await waitFor(() => expect(layouts.first).toEqual([50, 50]));

		const junctions = await findAllByTestId("junction");
		const middle = junctions.find(
			(junction) => junction.getAttribute("data-junction-type") === "cross"
		);

		await fireEvent.mouseDown(middle!, { clientX: 200, clientY: 200 });
		await fireEvent.mouseMove(document.body, { clientX: 240, clientY: 240 });

		await waitFor(() => {
			expect(layouts.first[0]).toBeCloseTo(60);
			expect(layouts.second[0]).toBeCloseTo(60);
		});

		await fireEvent.mouseUp(window);
	});
});
