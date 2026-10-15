import { describe, expect, it } from "vitest";
import { computePaneFlexBoxStyle } from "$lib/internal/utils/style.js";

function styleFor({
	units,
	size,
	defaultSize,
	paneCount = 2,
	direction,
	minPixels,
	maxPixels,
}: {
	units: "percentage" | "pixels";
	size?: number;
	defaultSize?: number;
	paneCount?: number;
	direction?: "horizontal" | "vertical";
	minPixels?: number;
	maxPixels?: number;
}) {
	return computePaneFlexBoxStyle({
		size,
		defaultSize,
		dragState: null,
		units,
		paneCount,
		direction,
		minPixels,
		maxPixels,
	});
}

describe("how a pane is handed to flex", () => {
	it("gives an absolute size to flex-basis and holds the pane there", () => {
		expect(styleFor({ units: "pixels", size: 260 })).toMatchObject({
			flexBasis: "260px",
			flexGrow: 0,
			flexShrink: 1,
		});
	});

	it("gives a share to flex-grow, so it divides what the bases left over", () => {
		expect(styleFor({ units: "percentage", size: 40 })).toMatchObject({
			flexBasis: 0,
			flexGrow: "40.0000",
			flexShrink: 1,
		});
	});

	it("writes a grow weight precisely enough to land on a whole pixel", () => {
		// Three significant digits put a 48px pane a fiftieth of a pixel out. A share is at
		// most 100, so four decimals is under a thousandth of a pixel of any group worth
		// laying out — and a fixed number of decimals can never reach for an exponent.
		expect(styleFor({ units: "percentage", size: 12.121212 }).flexGrow).toBe("12.1212");
		expect(styleFor({ units: "percentage", size: 100 }).flexGrow).toBe("100.0000");
	});

	it("hands a limit written in pixels to flex along the axis the pane is sized on", () => {
		// Flex holds an item at its own min and max exactly, where a share has to survive a
		// round trip through a percentage and lands a fraction of a pixel out.
		expect(
			styleFor({ units: "percentage", size: 40, direction: "horizontal", minPixels: 48 })
		).toMatchObject({ minWidth: "48px" });

		expect(
			styleFor({ units: "percentage", size: 40, direction: "vertical", minPixels: 48 })
		).toMatchObject({ minHeight: "48px" });

		expect(
			styleFor({ units: "pixels", size: 260, direction: "horizontal", maxPixels: 480 })
		).toMatchObject({ maxWidth: "480px" });
	});

	it("leaves the axis unbounded when no limit was written in pixels", () => {
		// A limit given as a share is already in the same currency as flex's own distribution,
		// so handing it over would only be a second way of saying the same thing.
		const style = styleFor({ units: "percentage", size: 40, direction: "horizontal" });
		expect("minWidth" in style).toBe(false);
		expect("maxWidth" in style).toBe(false);
	});

	it("falls back to the pane's own default size before there is a layout", () => {
		// Nothing is registered while the group renders on the server, so this is the markup
		// the pane is first painted with: a sidebar given 260px starts out 260px wide.
		expect(styleFor({ units: "pixels", defaultSize: 260 })).toMatchObject({
			flexBasis: "260px",
			flexGrow: 0,
		});
		expect(styleFor({ units: "percentage", defaultSize: 40 })).toMatchObject({
			flexBasis: 0,
			flexGrow: 40,
		});
	});

	it("lets a pane with nothing to go on fill the group until sizes arrive", () => {
		// A pane with no size of its own is the one meant to take up the slack.
		expect(styleFor({ units: "pixels" })).toMatchObject({ flexBasis: 0, flexGrow: 1 });
		expect(styleFor({ units: "percentage" })).toMatchObject({ flexBasis: 0, flexGrow: "1" });
	});

	it("fills the group when it is the only pane in it", () => {
		expect(styleFor({ units: "percentage", size: 100, paneCount: 1 })).toMatchObject({
			flexGrow: "1",
		});
	});

	it("keeps a grow weight out of exponential notation, which CSS cannot read", () => {
		// A share is always at most 100, which is what keeps `toPrecision` from reaching for an
		// exponent. Absolute sizes, which do run into the thousands, never become weights.
		const grow = styleFor({ units: "percentage", size: 99.98765 }).flexGrow;
		expect(String(grow)).not.toMatch(/e/i);
		expect(Number.parseFloat(String(grow))).toBeCloseTo(100, 0);
	});

	it("shuts off pointer events inside a pane only while a drag is running", () => {
		const idle = computePaneFlexBoxStyle({
			size: 50,
			defaultSize: undefined,
			dragState: null,
			units: "percentage",
			paneCount: 2,
		});
		expect("pointerEvents" in idle).toBe(false);

		const dragging = computePaneFlexBoxStyle({
			size: 50,
			defaultSize: undefined,
			dragState: {
				dragHandleId: "a",
				dragHandleRect: {} as DOMRect,
				initialCursorPosition: 0,
				initialLayout: [50, 50],
			},
			units: "percentage",
			paneCount: 2,
		});
		expect(dragging.pointerEvents).toBe("none");
	});
});
