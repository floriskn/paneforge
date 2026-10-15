import type { Direction } from "../types.js";
import { assert } from "./assert.js";

/**
 * The axis a resizer travels along when it is dragged.
 *
 * A group with `direction="horizontal"` stacks its panes in a row, so its resizers are
 * vertical bars that travel along the `x` axis, and vice versa.
 */
export type JunctionAxis = "x" | "y";

export type JunctionRect = {
	top: number;
	right: number;
	bottom: number;
	left: number;
};

/**
 * A resizer considered for junction detection, measured in the coordinate space
 * of the junction scope.
 */
export type JunctionCandidate = {
	/** The id of the resizer. */
	id: string;
	/**
	 * The id of the group the resizer belongs to. A group can only drive a single resizer
	 * at a time, so at most one candidate per group may take part in a junction.
	 */
	groupId: string;
	/** The axis the resizer travels along when dragged. */
	axis: JunctionAxis;
	/** The resizer's rect, relative to the junction scope. */
	rect: JunctionRect;
};

export type ComputeJunctionsOptions = {
	/** How close resizers must come, in pixels, to count as meeting. */
	tolerance: number;
	/**
	 * How close two parallel resizers must line up, in pixels, before the junctions they
	 * form are treated as one cross rather than as separate junctions that happen to
	 * overlap. Kept tight on purpose: junctions that merely sit near each other stay
	 * independent.
	 */
	crossTolerance: number;
};

/**
 * Where a junction is rendered.
 *
 * Of the resizers meeting at a junction, one runs straight through it while the others stop
 * against it. The junction is rendered inside the one that runs through, because it lies
 * entirely within that resizer's box — nothing clips it, and flex has already placed the
 * resizer across the junction's other axis.
 */
export type JunctionAnchor = {
	/** The resizer the junction is rendered inside. */
	resizerId: string;
	/** The axis that resizer travels along. */
	axis: JunctionAxis;
	/** How far along that resizer the junction sits, from its top or left edge. */
	offset: number;
	/**
	 * Which side the resizers that stop here arrive from, when they all arrive from one
	 * side. A cross is met from both, and has no single side.
	 */
	side: "start" | "end" | undefined;
};

export type ComputedJunction = {
	/** A stable id derived from the resizers taking part in the junction. */
	id: string;
	/** The center of the junction on the x axis, relative to the scope. */
	x: number;
	/** The center of the junction on the y axis, relative to the scope. */
	y: number;
	/** The thickness of the thickest resizer travelling along the x axis. */
	width: number;
	/** The thickness of the thickest resizer travelling along the y axis. */
	height: number;
	/** The ids of the resizers this junction moves along the x axis. */
	xResizerIds: string[];
	/** The ids of the resizers this junction moves along the y axis. */
	yResizerIds: string[];
	/** The resizer this junction is rendered inside, and which end of it. */
	anchor: JunctionAnchor;
	/**
	 * The junction's place in paint order. Junctions that overlap are independent of one
	 * another, and the one with the higher index sits on top and takes the pointer.
	 */
	index: number;
};

export function directionToJunctionAxis(direction: Direction): JunctionAxis {
	return direction === "horizontal" ? "x" : "y";
}

/**
 * Whether two rects overlap or sit within `tolerance` of one another on both axes.
 *
 * Perpendicular resizers usually _abut_ rather than overlap: the resizer of a nested group
 * stops exactly where the resizer of its parent group begins. A negative overlap of up to
 * `tolerance` is therefore still considered a touch.
 */
function areRectsTouching(a: JunctionRect, b: JunctionRect, tolerance: number): boolean {
	const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
	const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
	return overlapX >= -tolerance && overlapY >= -tolerance;
}

type ClusterMember = {
	id: string;
	axis: JunctionAxis;
	distance: number;
	thickness: number;
	rect: JunctionRect;
};

/** How far along a resizer's own length the junction sits, from its top or left edge. */
function offsetAlong(member: ClusterMember, x: number, y: number): number {
	return member.axis === "x" ? y - member.rect.top : x - member.rect.left;
}

/** How far the junction is from the nearer end of a resizer, along that resizer's length. */
function distanceToEnd(member: ClusterMember, x: number, y: number): number {
	const length =
		member.axis === "x"
			? member.rect.bottom - member.rect.top
			: member.rect.right - member.rect.left;
	const offset = offsetAlong(member, x, y);

	return Math.min(Math.abs(offset), Math.abs(length - offset));
}

/**
 * Picks the resizer that runs through the junction rather than stopping at it.
 *
 * The others end against it, so the junction sits at their very edge and would hang outside
 * their box. It falls well inside this one.
 */
function resolveAnchor(members: ClusterMember[], x: number, y: number): JunctionAnchor {
	let host: ClusterMember | null = null;
	let furthest = -1;

	for (const member of members) {
		const distance = distanceToEnd(member, x, y);

		// Ties are broken by id so the anchor never changes between measurements.
		if (distance < furthest) continue;
		if (distance === furthest && host && member.id >= host.id) continue;

		host = member;
		furthest = distance;
	}

	assert(host != null, "A junction always has at least one resizer to be rendered in.");

	// Which side the resizers that stop here arrive from, measured across the anchor.
	const anchor = host;
	const across = anchor.axis === "x" ? x : y;
	const sides = new Set(
		members
			.filter((member) => member !== anchor)
			.map((member) => {
				const center =
					anchor.axis === "x"
						? (member.rect.left + member.rect.right) / 2
						: (member.rect.top + member.rect.bottom) / 2;
				return center < across ? "start" : "end";
			})
	);

	return {
		resizerId: anchor.id,
		axis: anchor.axis,
		offset: offsetAlong(anchor, x, y),
		side: sides.size === 1 ? ([...sides][0] as "start" | "end") : undefined,
	};
}

type Cluster = {
	x: number;
	y: number;
	/** Keyed by group id, since a group can only drive one resizer at a time. */
	xMovers: Map<string, ClusterMember>;
	yMovers: Map<string, ClusterMember>;
};

/**
 * Keeps the candidate closest to the junction point for a given group, so a junction never
 * tries to drive two resizers belonging to the same group.
 */
function addMember(
	members: Map<string, ClusterMember>,
	candidate: JunctionCandidate,
	distance: number,
	thickness: number
) {
	const existing = members.get(candidate.groupId);
	if (existing && existing.distance <= distance) return;
	members.set(candidate.groupId, {
		id: candidate.id,
		axis: candidate.axis,
		distance,
		thickness,
		rect: candidate.rect,
	});
}

/**
 * Finds every point where resizers travelling along opposing axes meet.
 *
 * Detection is purely geometric, which is what makes it independent of how deeply the
 * groups involved are nested: two resizers form a junction when they touch on screen,
 * no matter how far apart they sit in the component tree.
 *
 * A junction always drives at least one resizer on each axis. A "T" junction is a single
 * resizer meeting the end of a perpendicular one; a "cross" junction is a resizer met by
 * perpendicular resizers on both of its sides.
 *
 * Only resizers that genuinely line up form a cross. Two junctions that sit close together
 * without lining up stay separate, so dragging one never moves the other; where their hit
 * areas overlap, the later one takes the pointer.
 */
export function computeJunctions(
	candidates: JunctionCandidate[],
	{ tolerance, crossTolerance }: ComputeJunctionsOptions
): ComputedJunction[] {
	const xMovers = candidates.filter((candidate) => candidate.axis === "x");
	const yMovers = candidates.filter((candidate) => candidate.axis === "y");
	if (xMovers.length === 0 || yMovers.length === 0) return [];

	const clusters: Cluster[] = [];

	for (const xMover of xMovers) {
		for (const yMover of yMovers) {
			if (!areRectsTouching(xMover.rect, yMover.rect, tolerance)) continue;

			// The junction sits on the center line of each resizer: the x mover is a bar that
			// runs along y, so it contributes the x coordinate, and vice versa.
			const x = (xMover.rect.left + xMover.rect.right) / 2;
			const y = (yMover.rect.top + yMover.rect.bottom) / 2;

			// Cluster by point rather than by resizer. A single resizer can take part in
			// several junctions along its length, so merging every resizer that touches it
			// would collapse those distinct junctions into one.
			//
			// `crossTolerance` is what separates a cross from two junctions that merely sit
			// near each other: only resizers that line up within it are driven together.
			let cluster = clusters.find(
				(candidate) =>
					Math.abs(candidate.x - x) <= crossTolerance &&
					Math.abs(candidate.y - y) <= crossTolerance
			);

			if (!cluster) {
				cluster = { x, y, xMovers: new Map(), yMovers: new Map() };
				clusters.push(cluster);
			}

			addMember(
				cluster.xMovers,
				xMover,
				Math.abs(x - cluster.x),
				xMover.rect.right - xMover.rect.left
			);
			addMember(
				cluster.yMovers,
				yMover,
				Math.abs(y - cluster.y),
				yMover.rect.bottom - yMover.rect.top
			);
		}
	}

	return (
		clusters
			.map((cluster) => {
				const xMembers = [...cluster.xMovers.values()];
				const yMembers = [...cluster.yMovers.values()];
				const xResizerIds = xMembers.map((member) => member.id);
				const yResizerIds = yMembers.map((member) => member.id);

				return {
					id: [...xResizerIds, ...yResizerIds].sort().join("|"),
					x: cluster.x,
					y: cluster.y,
					width: Math.max(...xMembers.map((member) => member.thickness)),
					height: Math.max(...yMembers.map((member) => member.thickness)),
					xResizerIds,
					yResizerIds,
					anchor: resolveAnchor([...xMembers, ...yMembers], cluster.x, cluster.y),
				};
			})
			// Paint order doubles as hit-testing order, so it has to be stable: two junctions
			// that overlap must keep the same one on top from measure to measure.
			.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
			.map((junction, index) => ({ ...junction, index }))
	);
}
