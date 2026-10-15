import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import MixedGroup from "./mixed-group.svelte";
import type { PaneSize, PaneUnits } from "$lib/index.js";

/** Observers a test can report through, so it can say the group changed size. */
const observers: Array<{ report: () => void; size: () => number }> = [];

function fireResize() {
	for (const observer of [...observers]) observer.report();
}

/** How many elements are being watched, to check that a group measures only when it must. */
function observedCount() {
	return observers.reduce((total, observer) => total + observer.size(), 0);
}

/**
 * jsdom does no layout, so every element carries the box it would have on screen as
 * `data-rect="left,top,right,bottom"`, which may be fractional as a real box is.
 *
 * Client and offset sizes are rounded to whole pixels here, as a browser rounds them, so that
 * a test can tell a measurement taken from the observer apart from one read off the element.
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
				return Math.round(boxOf(this)[side]);
			},
		});
	}

	globalThis.ResizeObserver = class {
		#callback: (entries: unknown[], observer: unknown) => void;
		#targets = new Set<Element>();

		constructor(callback: (entries: unknown[], observer: unknown) => void) {
			this.#callback = callback;
			observers.push({
				report: () => this.#report(),
				size: () => this.#targets.size,
			});
		}

		observe(target: Element) {
			this.#targets.add(target);
			this.#report();
		}

		unobserve(target: Element) {
			this.#targets.delete(target);
		}

		disconnect() {
			this.#targets.clear();
		}

		#report() {
			if (this.#targets.size === 0) return;
			this.#callback(
				[...this.#targets].map((target) => ({
					target,
					contentRect: target.getBoundingClientRect(),
				})),
				this
			);
		}
	} as unknown as typeof ResizeObserver;
}

function setup(
	props: {
		groupRect?: string;
		groupUnits?: PaneUnits;
		sidebarUnits?: PaneUnits;
		sidebarSize?: number;
		sidebarMin?: PaneSize;
		sidebarMax?: PaneSize;
		contentUnits?: PaneUnits;
		contentMin?: PaneSize;
		contentMax?: PaneSize;
		contentCollapsible?: boolean;
		aside?: boolean;
	} = {}
) {
	let layout: number[] = [];
	const result = render(MixedGroup, {
		onLayout: (next: number[]) => (layout = next),
		...props,
	});

	return { ...result, layout: () => layout };
}

/** Puts the group at a new width, as a window resize would. */
function resizeGroup(container: HTMLElement, width: number) {
	container.querySelector("[data-pane-group]")?.setAttribute("data-rect", `0,0,${width},400`);
	fireResize();
}

/** The style a pane was given, by test id. */
function styleOf(container: HTMLElement, testId: string) {
	return container.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.style;
}

beforeAll(useStubbedLayout);

afterEach(() => {
	observers.length = 0;
	cleanup();
});

describe("a pane sized in pixels beside one sizing itself as a share", () => {
	it("gives the sidebar its pixels and the rest to its neighbour", async () => {
		const { findByTestId, layout } = setup();

		const sidebar = await findByTestId("sidebar");
		const content = await findByTestId("content");

		// 600px for the panes: 300px of sidebar leaves 300px, which is half the group.
		await waitFor(() => expect(layout()).toEqual([300, 50]));

		// The two units are the two ways flex sizes a child: an absolute size is a basis, and
		// a share is a grow weight against what the basis left behind.
		expect(sidebar.style.flexBasis).toBe("300px");
		expect(sidebar.style.flexGrow).toBe("0");
		expect(Number.parseFloat(content.style.flexBasis)).toBe(0);
		expect(Number.parseFloat(content.style.flexGrow)).toBe(50);
	});

	it("says which unit each pane is sized in", async () => {
		const { findByTestId } = setup();

		expect((await findByTestId("sidebar")).getAttribute("data-units")).toBe("pixels");
		expect((await findByTestId("content")).getAttribute("data-units")).toBe("percentage");
	});

	it("keeps the sidebar's pixels when the group grows", async () => {
		const { container, findByTestId, layout } = setup();

		await findByTestId("sidebar");
		await waitFor(() => expect(layout()).toEqual([300, 50]));

		// 1200px for the panes now. The sidebar is absolute, so all 600 of it goes to the
		// pane sizing itself as a share — which is now three quarters of a bigger group.
		resizeGroup(container, 1204);

		await waitFor(() => expect(layout()).toEqual([300, 75]));
		expect((await findByTestId("sidebar")).style.flexBasis).toBe("300px");
	});

	it("keeps the sidebar's pixels when the group shrinks", async () => {
		const { container, findByTestId, layout } = setup();

		await findByTestId("sidebar");
		await waitFor(() => expect(layout()).toEqual([300, 50]));

		// 400px for the panes: the sidebar holds 300 and the content pane is left with 100.
		resizeGroup(container, 404);

		await waitFor(() => expect(layout()).toEqual([300, 25]));
	});

	it("splits a change between the panes sizing themselves as a share", async () => {
		const { container, findByTestId, layout } = setup({ aside: true });

		await findByTestId("aside");
		// 600px for the panes: 300 of sidebar, and the other two take 150px each.
		await waitFor(() => expect(layout()).toEqual([300, 25, 25]));

		// 900px for the panes. The extra 300 is split in proportion, so the two stay equal
		// to one another rather than the last one taking all of it.
		resizeGroup(container, 908);

		await waitFor(() => {
			const [sidebar, content, aside] = layout();
			expect(sidebar).toBe(300);
			expect(content).toBeCloseTo(100 / 3);
			expect(aside).toBeCloseTo(100 / 3);
		});
	});

	it("gives the sidebar's pixels up only once nothing else can", async () => {
		// The content pane may not go below half the group, so shrinking far enough leaves
		// nothing but the sidebar to take the rest.
		const { container, findByTestId, layout } = setup({ contentMin: 50 });

		await findByTestId("sidebar");
		await waitFor(() => expect(layout()).toEqual([300, 50]));

		// 400px for the panes, of which the content pane must have 200.
		resizeGroup(container, 404);

		await waitFor(() => expect(layout()).toEqual([200, 50]));
	});

	it("resizes by the distance actually dragged", async () => {
		const { findByTestId, layout } = setup();

		const resizer = await findByTestId("resizer");
		await waitFor(() => expect(layout()).toEqual([300, 50]));

		await fireEvent.mouseDown(resizer, { clientX: 302, clientY: 0 });
		await fireEvent.mouseMove(document.body, { clientX: 362, clientY: 0 });

		// 60px of pointer movement is 60px of sidebar, and the 240px left over is 40% of the
		// group the content pane is a share of.
		await waitFor(() => expect(layout()).toEqual([360, 40]));

		await fireEvent.mouseUp(window);
	});

	it("reads a share pane's minimum as a share of the whole group", async () => {
		const { findByTestId, layout } = setup({ contentMin: 30 });

		const resizer = await findByTestId("resizer");
		await waitFor(() => expect(layout()).toEqual([300, 50]));

		await fireEvent.mouseDown(resizer, { clientX: 302, clientY: 0 });
		await fireEvent.mouseMove(document.body, { clientX: 900, clientY: 0 });

		// 30% of the 600px on offer is 180px, so the sidebar stops at 420 — short of the 480
		// its own maximum would have allowed.
		await waitFor(() => expect(layout()).toEqual([420, 30]));

		await fireEvent.mouseUp(window);
	});

	it("lets a pane size itself as a share inside a group sizing in pixels", async () => {
		const { findByTestId, layout } = setup({
			groupUnits: "pixels",
			sidebarUnits: undefined,
			contentUnits: "percentage",
		});

		const sidebar = await findByTestId("sidebar");
		await waitFor(() => expect(layout()).toEqual([300, 50]));

		expect(sidebar.getAttribute("data-units")).toBe("pixels");
		expect((await findByTestId("content")).getAttribute("data-units")).toBe("percentage");
	});

	it("holds a pane taking a share to a minimum written in pixels", async () => {
		const { findByTestId, layout } = setup({ contentMin: "180px" });

		const resizer = await findByTestId("resizer");
		await waitFor(() => expect(layout()).toEqual([300, 50]));

		await fireEvent.mouseDown(resizer, { clientX: 302, clientY: 0 });
		await fireEvent.mouseMove(document.body, { clientX: 900, clientY: 0 });

		// 180px of the 600 on offer, whatever share of the group that happens to be, so the
		// sidebar stops at 420 rather than at its own maximum of 480.
		await waitFor(() => expect(layout()).toEqual([420, 30]));

		await fireEvent.mouseUp(window);
	});

	it("keeps a minimum in pixels the same size as the group changes", async () => {
		// The point of writing a limit in pixels: it does not move with the container, so a
		// pane refuses to go below the width its contents need whatever else happens.
		const { container, findByTestId, layout } = setup({
			contentMin: "180px",
			// Left to the content pane's minimum to stop the drag, rather than the sidebar's
			// own ceiling getting there first.
			sidebarMax: 2000,
		});

		const resizer = await findByTestId("resizer");
		await waitFor(() => expect(layout()).toEqual([300, 50]));

		await fireEvent.mouseDown(resizer, { clientX: 302, clientY: 0 });
		await fireEvent.mouseMove(document.body, { clientX: 900, clientY: 0 });

		// 180px of the 600 on offer is 30% of the group.
		await waitFor(() => expect(layout()).toEqual([420, 30]));
		await fireEvent.mouseUp(window);

		// 1200px for the panes now, so the same 180px is half the share it was. The sidebar
		// keeps the 420 it was dragged to and the content pane takes the rest.
		resizeGroup(container, 1204);
		await waitFor(() => expect(layout()).toEqual([420, 65]));

		await fireEvent.mouseDown(resizer, { clientX: 302, clientY: 0 });
		await fireEvent.mouseMove(document.body, { clientX: 1400, clientY: 0 });

		await waitFor(() => expect(layout()).toEqual([1020, 15]));

		await fireEvent.mouseUp(window);
	});

	it("clamps a pane back when the group shrinks past its minimum in pixels", async () => {
		const { container, findByTestId, layout } = setup({ contentMin: "180px", sidebarMin: 0 });

		await findByTestId("content");
		await waitFor(() => expect(layout()).toEqual([300, 50]));

		// 200px for the panes, of which the content pane must keep 180 — so the sidebar, which
		// was never told a minimum of its own, is squeezed into the 20px left.
		resizeGroup(container, 204);

		await waitFor(() => expect(layout()).toEqual([20, 90]));
	});

	it("reads a maximum in pixels the same way", async () => {
		const { findByTestId, layout } = setup({ contentMax: "200px" });

		const resizer = await findByTestId("resizer");

		await fireEvent.mouseDown(resizer, { clientX: 302, clientY: 0 });
		await fireEvent.mouseMove(document.body, { clientX: 0, clientY: 0 });

		// The content pane may not pass 200px, so the sidebar stops at 400 rather than going
		// down to its own minimum of 120.
		await waitFor(() => {
			const [sidebar, content] = layout();
			expect(sidebar).toBeCloseTo(400);
			// 200 of the 600 on offer.
			expect(content).toBeCloseTo(100 / 3);
		});

		await fireEvent.mouseUp(window);
	});

	it("takes a limit in shares on a pane sized in pixels", async () => {
		// The other way round: the pane is absolute and the limit is a share of the group.
		const { findByTestId, layout } = setup({ sidebarMax: "60%" });

		const resizer = await findByTestId("resizer");
		await waitFor(() => expect(layout()).toEqual([300, 50]));

		await fireEvent.mouseDown(resizer, { clientX: 302, clientY: 0 });
		await fireEvent.mouseMove(document.body, { clientX: 900, clientY: 0 });

		// 60% of the 600px on offer is 360px, and the 240px left is 40% of the group.
		await waitFor(() => expect(layout()).toEqual([360, 40]));

		await fireEvent.mouseUp(window);
	});

	it("never measures a group with nothing written in pixels", async () => {
		// Shares need no measurement at all, so nothing observes such a group.
		observers.length = 0;

		const { findByTestId } = setup({
			sidebarUnits: "percentage",
			sidebarSize: 40,
			sidebarMin: 10,
			sidebarMax: 90,
		});

		await findByTestId("sidebar");
		expect(observedCount()).toBe(0);
	});

	it("measures the group's real box, fraction and all", async () => {
		// Half a pixel of a group, spread across its panes, is what leaves a pane given 48px
		// 48.02px wide. The observer reports the box as it really is, where a client size is
		// rounded to whole pixels first.
		const { layout } = setup({
			groupRect: "0,0,604.5,400",
			contentUnits: "pixels",
		});

		// 604.5 less the 4px resizer is 600.5 for the panes, of which the sidebar has 300.
		// Rounding the group to 605 first would have left the content pane 301.
		await waitFor(() => expect(layout()).toEqual([300, 300.5]));
	});

	it("hands a limit written in pixels to flex as well", async () => {
		// Flex holds an item at its own min and max exactly. Our own share of the group has to
		// survive a round trip through a percentage, and lands a fraction of a pixel out.
		const { container, findByTestId } = setup({ contentMin: "180px" });

		await findByTestId("content");

		expect(styleOf(container, "content")?.minWidth).toBe("180px");
		// The sidebar's 480 maximum is in pixels, its minimum of 120 likewise.
		expect(styleOf(container, "sidebar")?.maxWidth).toBe("480px");
		expect(styleOf(container, "sidebar")?.minWidth).toBe("120px");
	});

	it("leaves a limit given as a share to the layout alone", async () => {
		// Already in the same currency as flex's own distribution, so handing it over would
		// only be a second way of saying the same thing.
		const { container, findByTestId } = setup({ contentMin: 30 });

		await findByTestId("content");
		expect(styleOf(container, "content")?.minWidth).toBe("");
	});

	it("gives a collapsible pane no floor, so it can still reach nothing", async () => {
		const { container, findByTestId } = setup({
			contentMin: "180px",
			contentCollapsible: true,
		});

		await findByTestId("content");
		expect(styleOf(container, "content")?.minWidth).toBe("");
	});

	it("leaves a group of nothing but shares alone", async () => {
		// No pane holds an absolute size, so there is nothing to measure and the layout stays
		// in percentages throughout.
		const { container, findByTestId, layout } = setup({
			sidebarUnits: "percentage",
			sidebarSize: 40,
			sidebarMin: 10,
			sidebarMax: 90,
		});

		await findByTestId("sidebar");
		await waitFor(() => expect(layout()).toEqual([40, 60]));

		resizeGroup(container, 1204);

		// Shares follow the group, so nothing about the layout changes.
		await waitFor(() => expect(layout()).toEqual([40, 60]));
		expect(container.querySelector("[data-pane-group]")?.getAttribute("data-units")).toBe(
			"percentage"
		);
	});
});
