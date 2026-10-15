import { describe, expect, it } from "vitest";
import {
	computeJunctions,
	directionToJunctionAxis,
	type JunctionCandidate,
} from "$lib/internal/utils/junctions.js";

const options = { tolerance: 4, crossTolerance: 0.5 };

/** A resizer that travels along the x axis: a vertical bar, thickness 4. */
function xMover(id: string, groupId: string, x: number, from: number, to: number) {
	return {
		id,
		groupId,
		axis: "x",
		rect: { left: x - 2, right: x + 2, top: from, bottom: to },
	} satisfies JunctionCandidate;
}

/** A resizer that travels along the y axis: a horizontal bar, thickness 4. */
function yMover(id: string, groupId: string, y: number, from: number, to: number) {
	return {
		id,
		groupId,
		axis: "y",
		rect: { top: y - 2, bottom: y + 2, left: from, right: to },
	} satisfies JunctionCandidate;
}

describe("directionToJunctionAxis", () => {
	it("maps a group's direction to the axis its resizers travel along", () => {
		// A horizontal group lays panes out in a row, so its resizers slide left and right.
		expect(directionToJunctionAxis("horizontal")).toBe("x");
		expect(directionToJunctionAxis("vertical")).toBe("y");
	});
});

describe("computeJunctions", () => {
	it("returns nothing when only one axis is present", () => {
		expect(computeJunctions([xMover("a", "g0", 100, 0, 400)], options)).toEqual([]);
		expect(computeJunctions([yMover("a", "g0", 100, 0, 400)], options)).toEqual([]);
	});

	it("finds a cross where two columns split at the same height", () => {
		// +-----+-----+
		// |  A  |  B  |
		// +=====|=====+
		// |  C  |  D  |
		// +-----+-----+
		const junctions = computeJunctions(
			[
				xMover("outer", "g0", 100, 0, 400),
				yMover("left", "g1", 200, 0, 98),
				yMover("right", "g2", 200, 102, 300),
			],
			options
		);

		expect(junctions).toHaveLength(1);
		expect(junctions[0]).toMatchObject({
			x: 100,
			y: 200,
			width: 4,
			height: 4,
			xResizerIds: ["outer"],
		});
		expect(junctions[0].yResizerIds.sort()).toEqual(["left", "right"]);
	});

	it("finds a tee where a single split ends against a perpendicular resizer", () => {
		const junctions = computeJunctions(
			[xMover("outer", "g0", 100, 0, 400), yMover("left", "g1", 200, 0, 98)],
			options
		);

		expect(junctions).toHaveLength(1);
		expect(junctions[0].xResizerIds).toEqual(["outer"]);
		expect(junctions[0].yResizerIds).toEqual(["left"]);
	});

	it("keeps junctions along the same resizer separate", () => {
		// A single full-height resizer met at two different heights is two junctions, not
		// one. Grouping by resizer rather than by point would collapse them together.
		const junctions = computeJunctions(
			[
				xMover("outer", "g0", 100, 0, 400),
				yMover("upper", "g1", 100, 0, 98),
				yMover("lower", "g1", 300, 0, 98),
			],
			options
		);

		expect(junctions).toHaveLength(2);
		expect(junctions.map((junction) => junction.y)).toEqual([100, 300]);
		expect(junctions[0].yResizerIds).toEqual(["upper"]);
		expect(junctions[1].yResizerIds).toEqual(["lower"]);
	});

	it("detects junctions regardless of how deeply the groups are nested", () => {
		// The horizontal bar belongs to a group seven levels below the vertical one. Only
		// the geometry matters, so the distance in the tree is irrelevant.
		const junctions = computeJunctions(
			[xMover("root", "g0", 500, 0, 400), yMover("deep", "g7", 200, 300, 498)],
			options
		);

		expect(junctions).toHaveLength(1);
		expect(junctions[0]).toMatchObject({ x: 500, y: 200 });
	});

	it("ignores resizers that do not reach each other", () => {
		const junctions = computeJunctions(
			[xMover("outer", "g0", 100, 0, 400), yMover("stub", "g1", 200, 0, 50)],
			options
		);

		expect(junctions).toEqual([]);
	});

	it("splits a cross back into two tees once the two sides drift apart", () => {
		const junctions = computeJunctions(
			[
				xMover("outer", "g0", 100, 0, 400),
				yMover("left", "g1", 200, 0, 98),
				yMover("right", "g2", 240, 102, 300),
			],
			options
		);

		expect(junctions).toHaveLength(2);
		expect(junctions.map((junction) => junction.y)).toEqual([200, 240]);
	});

	it("never drives two resizers from the same group, keeping the nearest", () => {
		// A group has a single drag state, so only one of its resizers can take part.
		const junctions = computeJunctions(
			[
				xMover("outer", "g0", 100, 0, 400),
				yMover("near", "g1", 200, 0, 98),
				yMover("far", "g1", 200.2, 0, 98),
			],
			options
		);

		expect(junctions).toHaveLength(1);
		expect(junctions[0].yResizerIds).toEqual(["near"]);
	});

	it("keeps junctions that sit close together independent of one another", () => {
		// Two splits three pixels apart are two junctions, not one cross. Dragging either
		// has to leave the other alone.
		const junctions = computeJunctions(
			[
				xMover("outer", "g0", 100, 0, 400),
				yMover("left", "g1", 200, 0, 98),
				yMover("right", "g2", 203, 102, 300),
			],
			options
		);

		expect(junctions).toHaveLength(2);
		expect(junctions[0].yResizerIds).toEqual(["left"]);
		expect(junctions[1].yResizerIds).toEqual(["right"]);
	});

	it("forms a cross only where the two sides line up", () => {
		const junctions = computeJunctions(
			[
				xMover("outer", "g0", 100, 0, 400),
				yMover("left", "g1", 200, 0, 98),
				yMover("right", "g2", 200, 102, 300),
			],
			options
		);

		expect(junctions).toHaveLength(1);
		expect(junctions[0].yResizerIds.sort()).toEqual(["left", "right"]);
	});

	it("sizes the junction to the resizers it crosses", () => {
		const junctions = computeJunctions(
			[
				{
					id: "outer",
					groupId: "g0",
					axis: "x",
					rect: { left: 96, right: 108, top: 0, bottom: 400 },
				},
				yMover("left", "g1", 200, 0, 96),
			],
			options
		);

		expect(junctions[0]).toMatchObject({ width: 12, height: 4 });
	});

	it("gives a junction the same id no matter the order it was measured in", () => {
		const candidates = [
			xMover("outer", "g0", 100, 0, 400),
			yMover("left", "g1", 200, 0, 98),
			yMover("right", "g2", 200, 102, 300),
		];

		const [forwards] = computeJunctions(candidates, options);
		const [backwards] = computeJunctions([...candidates].reverse(), options);

		expect(forwards.id).toBe(backwards.id);
	});

	it("orders overlapping junctions so the same one keeps taking the pointer", () => {
		// Paint order decides which junction a pointer lands on, so it must not depend on
		// the order the resizers happened to be measured in.
		const candidates = [
			xMover("outer", "g0", 100, 0, 400),
			yMover("left", "g1", 200, 0, 98),
			yMover("right", "g2", 203, 102, 300),
		];

		const forwards = computeJunctions(candidates, options);
		const backwards = computeJunctions([...candidates].reverse(), options);

		expect(forwards.map((junction) => junction.index)).toEqual([0, 1]);
		expect(backwards.map((junction) => junction.id)).toEqual(
			forwards.map((junction) => junction.id)
		);
	});

	it("anchors the junction to the resizer that runs through it", () => {
		// The nested resizer stops at the junction, so it would hang outside its box. The
		// outer one runs straight through, and the junction falls well inside it.
		const [junction] = computeJunctions(
			[xMover("outer", "g0", 100, 0, 400), yMover("left", "g1", 200, 0, 98)],
			options
		);

		expect(junction.anchor).toEqual({
			resizerId: "outer",
			axis: "x",
			// 200px down the outer resizer, which starts at y=0.
			offset: 200,
			// The nested split arrives from the left.
			side: "start",
		});
	});

	it("reports the other side when the nested split arrives from the right", () => {
		const [junction] = computeJunctions(
			[xMover("outer", "g0", 100, 0, 400), yMover("right", "g1", 200, 102, 300)],
			options
		);

		expect(junction.anchor).toMatchObject({ resizerId: "outer", side: "end" });
	});

	it("anchors to a resizer travelling along y when that is the one running through", () => {
		// A vertical outer group: the horizontal bar runs through, and the vertical bar
		// above it stops against it.
		const [junction] = computeJunctions(
			[yMover("outer", "g0", 200, 0, 400), xMover("above", "g1", 100, 0, 198)],
			options
		);

		expect(junction.anchor).toEqual({
			resizerId: "outer",
			axis: "y",
			offset: 100,
			side: "start",
		});
	});

	it("gives a cross no single side, since it is met from both", () => {
		const candidates = [
			xMover("outer", "g0", 100, 0, 400),
			yMover("left", "g1", 200, 0, 98),
			yMover("right", "g2", 200, 102, 300),
		];

		const [forwards] = computeJunctions(candidates, options);
		const [backwards] = computeJunctions([...candidates].reverse(), options);

		expect(forwards.anchor).toEqual(backwards.anchor);
		expect(forwards.anchor).toMatchObject({ resizerId: "outer", side: undefined });
	});

	it("keeps the junction inside the box of the resizer it is rendered in", () => {
		// This is the property that lets panes and groups go on hiding their overflow.
		const outer = xMover("outer", "g0", 100, 0, 400);
		const [junction] = computeJunctions([outer, yMover("left", "g1", 200, 0, 98)], options);

		const length = outer.rect.bottom - outer.rect.top;

		expect(junction.anchor.offset - junction.height / 2).toBeGreaterThanOrEqual(0);
		expect(junction.anchor.offset + junction.height / 2).toBeLessThanOrEqual(length);
		// Across the anchor it spans exactly the anchor's own thickness.
		expect(junction.width).toBe(outer.rect.right - outer.rect.left);
	});

	it("finds junctions between hairline resizers", () => {
		// A VS Code style layout draws its resizers as 1px lines, which leaves almost nothing
		// for two of them to overlap on.
		const outer = {
			id: "outer",
			groupId: "g0",
			axis: "x",
			rect: { left: 99.5, right: 100.5, top: 0, bottom: 400 },
		} satisfies JunctionCandidate;
		const nested = {
			id: "nested",
			groupId: "g1",
			axis: "y",
			rect: { left: 0, right: 99.5, top: 199.5, bottom: 200.5 },
		} satisfies JunctionCandidate;

		const [junction] = computeJunctions([outer, nested], options);

		expect(junction).toMatchObject({ x: 100, y: 200, width: 1, height: 1 });
		expect(junction.anchor).toMatchObject({ resizerId: "outer", axis: "x", offset: 200 });
		// Still inside the resizer it renders in, so nothing clips it.
		expect(junction.anchor.offset - junction.height / 2).toBeGreaterThanOrEqual(0);
		expect(junction.anchor.offset + junction.height / 2).toBeLessThanOrEqual(
			outer.rect.bottom - outer.rect.top
		);
	});
});
