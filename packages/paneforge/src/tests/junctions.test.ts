import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { mount, unmount } from "svelte";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import JunctionDeep from "./junction-deep.svelte";
import JunctionGrid from "./junction-grid.svelte";

/**
 * jsdom does no layout, so every element carries the rect it would have on screen as
 * `data-rect="left,top,right,bottom"`.
 */
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
		splitRight?: boolean;
		rightSplitAt?: number;
		rightTopMinSize?: number;
		onAnchorDragging?: (isDragging: boolean) => void;
		onDragging?: (id: string, isDragging: boolean) => void;
	} = {}
) {
	const layouts = {
		root: [] as number[],
		left: [] as number[],
		right: [] as number[],
	};

	const result = render(JunctionGrid, {
		onRootLayout: (layout: number[]) => (layouts.root = layout),
		onLeftLayout: (layout: number[]) => (layouts.left = layout),
		onRightLayout: (layout: number[]) => (layouts.right = layout),
		...props,
	});

	return { ...result, layouts };
}

beforeAll(useStubbedLayout);

// Auto cleanup only registers itself when vitest globals are enabled, and they are not.
afterEach(cleanup);

describe("PaneJunctions", () => {
	it("finds the cross where the two nested splits meet the outer split", async () => {
		const { findAllByTestId } = setup();

		const junctions = await findAllByTestId("junction");

		expect(junctions).toHaveLength(1);
		expect(junctions[0].getAttribute("data-junction-type")).toBe("cross");
		expect(junctions[0].getAttribute("data-pane-junction")).toBe("");

		// Both nested resizers stop at the junction; the outer one runs through it, so that
		// is where it renders. It spans the outer resizer thickness and sits 200px down it.
		expect(junctions[0].parentElement?.getAttribute("data-pane-resizer-id")).toBe(
			"root-resizer"
		);
		expect(junctions[0].getAttribute("data-junction-axis")).toBe("x");
		// Met from both sides, so there is no single side.
		expect(junctions[0].getAttribute("data-junction-side")).toBe(null);
		expect(junctions[0].style.left).toBe("0px");
		expect(junctions[0].style.width).toBe("100%");
		expect(junctions[0].style.top).toBe("200px");
		expect(junctions[0].style.height).toBe("4px");
		expect(junctions[0].style.transform).toBe("translateY(-50%)");
	});

	it("resizes every group it touches from a single drag", async () => {
		const { findAllByTestId, layouts } = setup();

		const [junction] = await findAllByTestId("junction");

		await fireEvent.mouseDown(junction, { clientX: 200, clientY: 200 });
		await fireEvent.mouseMove(document.body, { clientX: 240, clientY: 260 });

		await waitFor(() => {
			// 40px of 400 across the outer group, 60px of 400 down each nested group.
			expect(layouts.root[0]).toBeCloseTo(60);
			expect(layouts.left[0]).toBeCloseTo(65);
			expect(layouts.right[0]).toBeCloseTo(65);
		});
	});

	it("takes the resizers on an axis only as far as all of them can go", async () => {
		// The right column may not go above 35, and a junction drags both columns as one line,
		// so the left column stops there too rather than running on alone and leaving the line
		// broken in two.
		const { findAllByTestId, layouts } = setup({ rightTopMinSize: 35 });

		const [junction] = await findAllByTestId("junction");
		await waitFor(() => expect(layouts.left).toEqual([50, 50]));

		await fireEvent.mouseDown(junction, { clientX: 200, clientY: 200 });
		await fireEvent.mouseMove(document.body, { clientX: 200, clientY: 0 });

		await waitFor(() => {
			expect(layouts.right[0]).toBeCloseTo(35);
			expect(layouts.left[0]).toBeCloseTo(35);
		});

		await fireEvent.mouseUp(window);
	});

	it("keeps the other axis free while one axis runs out of room", async () => {
		// The two axes have nothing to say to each other, so a column that cannot go further
		// does not hold the outer divider back.
		const { findAllByTestId, layouts } = setup({ rightTopMinSize: 35 });

		const [junction] = await findAllByTestId("junction");
		await waitFor(() => expect(layouts.root).toEqual([50, 50]));

		await fireEvent.mouseDown(junction, { clientX: 200, clientY: 200 });
		await fireEvent.mouseMove(document.body, { clientX: 240, clientY: 0 });

		await waitFor(() => {
			expect(layouts.left[0]).toBeCloseTo(35);
			expect(layouts.root[0]).toBeCloseTo(60);
		});

		await fireEvent.mouseUp(window);
	});

	it("does not also start the drag of the resizer it is rendered inside", async () => {
		// The junction is a child of one of the resizers it drives, so its pointer events
		// would otherwise reach that resizer and start a second, single-axis drag on top.
		const dragging: boolean[] = [];
		const { findAllByTestId, layouts } = setup({
			onAnchorDragging: (isDragging) => dragging.push(isDragging),
		});

		const [junction] = await findAllByTestId("junction");
		expect(junction.parentElement?.getAttribute("data-pane-resizer-id")).toBe("root-resizer");

		await fireEvent.mouseDown(junction, { clientX: 200, clientY: 200 });

		// Once, from the junction. A bubbled event would make it twice.
		expect(dragging).toEqual([true]);

		await fireEvent.mouseMove(document.body, { clientX: 240, clientY: 260 });
		await waitFor(() => {
			expect(layouts.root[0]).toBeCloseTo(60);
			expect(layouts.left[0]).toBeCloseTo(65);
			expect(layouts.right[0]).toBeCloseTo(65);
		});

		await fireEvent.mouseUp(window);
		await waitFor(() => expect(dragging).toEqual([true, false]));
	});

	it("marks every resizer it drives as active, so they can be styled while dragging", async () => {
		const { container, findAllByTestId } = setup();

		const [junction] = await findAllByTestId("junction");
		const resizerActive = () =>
			[...container.querySelectorAll("[data-pane-resizer]")].map((resizer) =>
				resizer.getAttribute("data-active")
			);

		expect(resizerActive()).toEqual([null, null, null]);

		await fireEvent.mouseDown(junction, { clientX: 200, clientY: 200 });

		// All three, including the two the pointer is not over.
		await waitFor(() => expect(resizerActive()).toEqual(["pointer", "pointer", "pointer"]));

		await fireEvent.mouseUp(window);
		await waitFor(() => expect(resizerActive()).toEqual([null, null, null]));
	});

	it("reports every resizer it drove as no longer dragging once let go", async () => {
		// The junction starts the drag on each resizer itself, so it cannot leave the closing
		// half to them: anything styled off `onDraggingChange` would stay stuck on.
		const events: Array<[string, boolean]> = [];
		const { findAllByTestId } = setup({
			onDragging: (id, isDragging) => events.push([id, isDragging]),
		});

		const [junction] = await findAllByTestId("junction");

		await fireEvent.mouseDown(junction, { clientX: 200, clientY: 200 });
		await fireEvent.mouseMove(document.body, { clientX: 240, clientY: 260 });
		await fireEvent.mouseUp(window);

		await waitFor(() => {
			const started = events.filter(([, isDragging]) => isDragging).map(([id]) => id);
			const stopped = events.filter(([, isDragging]) => !isDragging).map(([id]) => id);

			expect(started.sort()).toEqual(["left-resizer", "right-resizer", "root-resizer"]);
			// Exactly the same set, and no repeats either way.
			expect(stopped.sort()).toEqual(started.sort());
		});
	});

	it("reports dragging once per resizer, even released over the junction", async () => {
		const events: Array<[string, boolean]> = [];
		const { findAllByTestId } = setup({
			onDragging: (id, isDragging) => events.push([id, isDragging]),
		});

		const [junction] = await findAllByTestId("junction");

		await fireEvent.mouseDown(junction, { clientX: 200, clientY: 200 });
		// Let go without moving, and over the junction rather than the window.
		await fireEvent.mouseUp(junction);

		await waitFor(() => expect(events).toHaveLength(6));
		expect(events.filter(([, isDragging]) => !isDragging)).toHaveLength(3);
	});

	it("marks the junction active while it is being dragged, and lets go on mouseup", async () => {
		const { findAllByTestId } = setup();

		const [junction] = await findAllByTestId("junction");

		await fireEvent.mouseDown(junction, { clientX: 200, clientY: 200 });
		await waitFor(() => expect(junction.getAttribute("data-active")).toBe("pointer"));

		await fireEvent.mouseUp(window);
		await waitFor(() =>
			expect(
				document.querySelector("[data-pane-junction]")?.getAttribute("data-active")
			).toBe(null)
		);
	});

	it("keeps two nearby splits as separate junctions, and drags them separately", async () => {
		// The two nested splits are three pixels apart, so they line up closely enough to
		// overlap but not closely enough to be one cross.
		const { findAllByTestId, layouts } = setup({ rightSplitAt: 201 });

		const junctions = await findAllByTestId("junction");

		expect(junctions).toHaveLength(2);
		expect(junctions.map((junction) => junction.getAttribute("data-junction-type"))).toEqual([
			"tee",
			"tee",
		]);

		const before = [...layouts.right];

		// The later junction is the one a pointer would land on where they overlap.
		await fireEvent.mouseDown(junctions[0], { clientX: 200, clientY: 200 });
		await fireEvent.mouseMove(document.body, { clientX: 240, clientY: 260 });

		await waitFor(() => {
			expect(layouts.root[0]).toBeCloseTo(60);
			expect(layouts.left[0]).toBeCloseTo(65);
		});

		// Dragging one junction must leave the other one's group untouched.
		expect(layouts.right).toEqual(before);
	});

	it("falls back to a tee when only one side is split", async () => {
		const { findAllByTestId, layouts } = setup({ splitRight: false });

		const junctions = await findAllByTestId("junction");

		expect(junctions).toHaveLength(1);
		expect(junctions[0].getAttribute("data-junction-type")).toBe("tee");

		await fireEvent.mouseDown(junctions[0], { clientX: 200, clientY: 200 });
		await fireEvent.mouseMove(document.body, { clientX: 240, clientY: 260 });

		await waitFor(() => {
			expect(layouts.root[0]).toBeCloseTo(60);
			expect(layouts.left[0]).toBeCloseTo(65);
		});
	});
});

describe("junction hosting", () => {
	/** The resizer a junction is rendered in, which is the one it is anchored to. */
	function hostOf(junction: HTMLElement) {
		return junction.parentElement?.getAttribute("data-pane-resizer-id");
	}

	it("renders each junction inside the resizer that runs through it", async () => {
		const { findAllByTestId } = render(JunctionDeep);

		const junctions = await findAllByTestId("junction");

		expect(junctions).toHaveLength(3);
		// Three different anchors, at three different depths, in document order.
		expect(junctions.map(hostOf)).toEqual(["root-resizer", "inner-resizer", "mid-resizer"]);
	});

	it("measures one offset per junction, and takes the other axis from the anchor", async () => {
		const { findAllByTestId } = render(JunctionDeep);

		const junctions = await findAllByTestId("junction");
		const byHost = new Map(junctions.map((junction) => [hostOf(junction), junction]));

		// `inner-resizer` runs top to bottom, so only the distance down it is measured.
		const inner = byHost.get("inner-resizer");
		expect(inner?.style.left).toBe("0px");
		expect(inner?.style.width).toBe("100%");
		expect(inner?.style.top).toBe("100px");
		expect(inner?.style.transform).toBe("translateY(-50%)");

		// `mid-resizer` runs left to right, so the offset is along x instead. Its box starts
		// at x=304 and the junction is at 452.
		const mid = byHost.get("mid-resizer");
		expect(mid?.style.top).toBe("0px");
		expect(mid?.style.height).toBe("100%");
		expect(mid?.style.left).toBe("148px");
		expect(mid?.style.transform).toBe("translateX(-50%)");
	});

	it("keeps each junction inside the box of the resizer it renders in", async () => {
		// This is what lets panes and groups go on hiding their overflow: a junction never
		// reaches outside the resizer it is rendered in.
		const { findAllByTestId } = render(JunctionDeep);

		const junctions = await findAllByTestId("junction");

		for (const junction of junctions) {
			const anchor = junction.parentElement as HTMLElement;
			const anchorRect = anchor.getBoundingClientRect();
			// The measured offset runs along the anchor, which is the axis it travels on.
			const alongY = junction.getAttribute("data-junction-axis") === "x";

			const offset = Number.parseFloat(alongY ? junction.style.top : junction.style.left);
			const size = Number.parseFloat(alongY ? junction.style.height : junction.style.width);
			const length = alongY ? anchorRect.height : anchorRect.width;

			expect(offset - size / 2).toBeGreaterThanOrEqual(0);
			expect(offset + size / 2).toBeLessThanOrEqual(length);
		}
	});

	it("only makes a resizer a containing block once it anchors something", async () => {
		const { container, findAllByTestId } = render(JunctionDeep);

		await findAllByTestId("junction");

		const resizer = (id: string) =>
			container.querySelector<HTMLElement>(`[data-pane-resizer-id="${id}"]`);

		expect(resizer("root-resizer")?.style.position).toBe("relative");
		expect(resizer("mid-resizer")?.style.position).toBe("relative");
		// `deep-resizer` takes part in a junction but is not the one it runs through.
		expect(resizer("deep-resizer")?.style.position).toBe("");
	});
});

describe("server rendering", () => {
	/**
	 * Junctions are found by measuring, which cannot happen on the server, so nothing is
	 * rendered for them until an effect has run. Hydration only matches if the client's
	 * first render agrees, so these assertions pin the two together: whatever the server
	 * emits, the client must emit the same thing before any effect runs.
	 */
	it("renders no junctions until effects have run", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);

		const component = mount(JunctionDeep, { target });

		try {
			// The panes and resizers are all present, so the markup is not empty.
			expect(target.querySelectorAll("[data-pane]").length).toBeGreaterThan(0);
			expect(target.querySelectorAll("[data-pane-resizer]").length).toBeGreaterThan(0);
			expect(target.querySelectorAll("[data-pane-junction]")).toHaveLength(0);
		} finally {
			unmount(component);
			target.remove();
		}
	});

	it("leaves every resizer's position alone until it anchors a junction", () => {
		const target = document.createElement("div");
		document.body.appendChild(target);

		const component = mount(JunctionDeep, { target });

		try {
			const resizers = [...target.querySelectorAll<HTMLElement>("[data-pane-resizer]")];

			expect(resizers.length).toBeGreaterThan(0);
			expect(resizers.map((resizer) => resizer.style.position)).toEqual(
				resizers.map(() => "")
			);
		} finally {
			unmount(component);
			target.remove();
		}
	});

	it("never writes an undefined value into a style attribute", async () => {
		// `undefined` serialises into the style string as-is, which ships invalid CSS in
		// server-rendered markup.
		const { container, findAllByTestId } = render(JunctionDeep);

		await findAllByTestId("junction");

		const styled = [...container.querySelectorAll("[style]")].map((element) =>
			element.getAttribute("style")
		);

		expect(styled.length).toBeGreaterThan(0);
		expect(styled.filter((style) => style?.includes("undefined"))).toEqual([]);
	});
});
