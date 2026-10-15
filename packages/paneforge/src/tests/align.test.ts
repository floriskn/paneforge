import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import AlignedGrid from "./aligned-grid.svelte";

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
		align?: boolean;
		rightPanes?: number;
		rightTopMinSize?: number;
		rightTopSize?: number;
		outer?: "horizontal" | "vertical";
	} = {}
) {
	const layouts = { left: [] as number[], right: [] as number[] };

	const result = render(AlignedGrid, {
		onLeftLayout: (layout: number[]) => (layouts.left = layout),
		onRightLayout: (layout: number[]) => (layouts.right = layout),
		...props,
	});

	return { ...result, layouts };
}

/** Drags the left divider down by 40px of a 400px column, which is 10%. */
async function dragLeftDivider(resizer: HTMLElement) {
	await fireEvent.mouseDown(resizer, { clientX: 0, clientY: 160 });
	await fireEvent.mouseMove(document.body, { clientX: 0, clientY: 200 });
}

beforeAll(useStubbedLayout);
afterEach(cleanup);

describe("aligned groups", () => {
	it("leaves each group its own sizes", async () => {
		// Nothing is shared or handed over: both keep exactly what they were given.
		const { findByTestId, layouts } = setup();

		await findByTestId("top-left");

		await waitFor(() => {
			expect(layouts.left).toEqual([40, 60]);
			expect(layouts.right).toEqual([70, 30]);
		});
	});

	it("drags dividers together while they line up", async () => {
		const { findByTestId, layouts } = setup({ rightTopSize: 40 });

		const resizer = await findByTestId("left-resizer");
		await waitFor(() => {
			expect(layouts.left).toEqual([40, 60]);
			expect(layouts.right).toEqual([40, 60]);
		});

		await dragLeftDivider(resizer);

		await waitFor(() => {
			expect(layouts.left[0]).toBeCloseTo(50);
			expect(layouts.right[0]).toBeCloseTo(50);
		});

		await fireEvent.mouseUp(window);
	});

	it("drags them together from the other group too", async () => {
		const { findByTestId, layouts } = setup({ rightTopSize: 40 });

		const resizer = await findByTestId("right-resizer");
		await waitFor(() => expect(layouts.right).toEqual([40, 60]));

		await fireEvent.mouseDown(resizer, { clientX: 300, clientY: 158 });
		await fireEvent.mouseMove(document.body, { clientX: 300, clientY: 118 });

		await waitFor(() => {
			expect(layouts.right[0]).toBeCloseTo(30);
			expect(layouts.left[0]).toBeCloseTo(30);
		});

		await fireEvent.mouseUp(window);
	});

	it("ignores a divider that does not line up", async () => {
		// The right column is split at 70 and the left at 40, so they have nothing to do with
		// each other and dragging one leaves the other alone.
		const { findByTestId, layouts } = setup();

		const resizer = await findByTestId("left-resizer");
		await waitFor(() => expect(layouts.right).toEqual([70, 30]));

		await dragLeftDivider(resizer);

		await waitFor(() => expect(layouts.left[0]).toBeCloseTo(50));
		expect(layouts.right).toEqual([70, 30]);

		await fireEvent.mouseUp(window);
	});

	it("leaves lined-up dividers independent when not aligned", async () => {
		const { findByTestId, layouts } = setup({ rightTopSize: 40, align: false });

		const resizer = await findByTestId("left-resizer");
		await waitFor(() => expect(layouts.right).toEqual([40, 60]));

		await dragLeftDivider(resizer);

		await waitFor(() => expect(layouts.left[0]).toBeCloseTo(50));
		expect(layouts.right).toEqual([40, 60]);

		await fireEvent.mouseUp(window);
	});

	it("stops both where the tighter of them has to stop", async () => {
		// Dragged as one line, so they stay one line: the right column may not go below 35, and
		// that is where the left one stops too, even though it had room to spare.
		const { findByTestId, layouts } = setup({ rightTopSize: 40, rightTopMinSize: 35 });

		const resizer = await findByTestId("left-resizer");
		await waitFor(() => expect(layouts.left).toEqual([40, 60]));

		await fireEvent.mouseDown(resizer, { clientX: 0, clientY: 160 });
		await fireEvent.mouseMove(document.body, { clientX: 0, clientY: 0 });

		await waitFor(() => {
			expect(layouts.right[0]).toBeCloseTo(35);
			expect(layouts.left[0]).toBeCloseTo(35);
		});

		await fireEvent.mouseUp(window);
	});

	it("holds them together for the whole drag, not just at the end", async () => {
		// Every move is negotiated, so they are never briefly apart on the way.
		const { findByTestId, layouts } = setup({ rightTopSize: 40, rightTopMinSize: 35 });

		const resizer = await findByTestId("left-resizer");
		await waitFor(() => expect(layouts.left).toEqual([40, 60]));

		await fireEvent.mouseDown(resizer, { clientX: 0, clientY: 160 });

		for (const clientY of [150, 140, 130, 120, 100, 60, 0]) {
			await fireEvent.mouseMove(document.body, { clientX: 0, clientY });
			await waitFor(() => expect(layouts.left[0]).toBeCloseTo(layouts.right[0]));
		}

		await fireEvent.mouseUp(window);
	});

	it("starts and stops linking as alignment is switched", async () => {
		// Whether two dividers travel together is worked out when the drag starts, so there is
		// no state to carry across: switching alignment simply changes the next drag.
		const { rerender, findByTestId, layouts } = setup({ rightTopSize: 40, align: false });

		const resizer = await findByTestId("left-resizer");
		await waitFor(() => expect(layouts.right).toEqual([40, 60]));

		await dragLeftDivider(resizer);
		await fireEvent.mouseUp(window);
		await waitFor(() => expect(layouts.left[0]).toBeCloseTo(50));
		expect(layouts.right).toEqual([40, 60]);

		await rerender({ align: true });

		await dragLeftDivider(resizer);
		await waitFor(() => {
			expect(layouts.left[0]).toBeCloseTo(60);
			// Moved by the same 10 the left one did, rather than staying put.
			expect(layouts.right[0]).toBeCloseTo(50);
		});

		await fireEvent.mouseUp(window);
	});
});
