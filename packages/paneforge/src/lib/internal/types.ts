import type { Snippet } from "svelte";
import type { attachRef } from "svelte-toolbelt";
import type { JunctionAnchor } from "./utils/junctions.js";

export type Direction = "horizontal" | "vertical";

/**
 * The unit a pane is sized in.
 *
 * `percentage` sizes are shares of the group, so they follow it as it resizes. `pixels`
 * sizes are absolute: the pane keeps its size when the group changes, and the difference is
 * taken up by the panes sizing themselves as a share, or by whichever pane can give it.
 *
 * Panes of both kinds can sit in the same group. Every size on a pane is read in its own
 * unit, and a percentage is a share of the whole group either way.
 */
export type PaneUnits = "percentage" | "pixels";

/** @deprecated Units are a property of a pane. Use {@link PaneUnits}. */
export type PaneGroupUnits = PaneUnits;

/**
 * What double clicking a resize handle does to the sizes in its group.
 *
 * `none` leaves the double click alone, to be handled wherever you like. `even` gives every
 * pane in the group the same size. `reset` puts them back to the sizes they started at.
 */
export type PaneDoubleClick = "none" | "even" | "reset";

export type PaneOnCollapse = () => void;
export type PaneOnExpand = () => void;
export type PaneOnResize = (size: number, prevSize: number | undefined) => void;

export type PaneCallbacks = {
	onCollapse?: PaneOnCollapse;
	onExpand?: PaneOnExpand;
	onResize?: PaneOnResize;
};

/**
 * A size on a pane.
 *
 * A bare number is read in the pane's own `units`. A string names its own unit instead, so
 * `"180px"` holds a pane that takes a share of the group to a minimum in pixels, and `"20%"`
 * gives a pane sized in pixels a limit that is a share of the group.
 */
export type PaneSize = number | `${number}px` | `${number}%`;

/** A size on a pane, with the unit it is to be read in settled. */
export type PaneSizeValue = {
	value: number;
	units: PaneUnits;
};

/** What a pane says about its own size, in whichever units each of them was written in. */
export type PaneSizeConstraints = {
	collapsedSize?: number | undefined;
	collapsible?: boolean | undefined;
	defaultSize?: PaneSizeValue | undefined;
	maxSize?: PaneSizeValue | undefined;
	minSize?: PaneSizeValue | undefined;
};

/** A pane's constraints, in the unit its group keeps its layout in. */
export type PaneConstraints = {
	collapsedSize?: number | undefined;
	collapsible?: boolean | undefined;
	defaultSize?: number | undefined;
	maxSize?: number | undefined;
	minSize?: number | undefined;
};

export type PaneTransitionState = "" | "collapsing" | "expanding";

export type PaneData = {
	callbacks: PaneCallbacks;
	constraints: PaneConstraints;
	id: string;
	idIsFromProps: boolean;
	order: number | undefined;
};

export type DragState = {
	dragHandleId: string;
	dragHandleRect: DOMRect;
	initialCursorPosition: number;
	initialLayout: number[];
	/**
	 * Set when the drag was started by a junction driving several resizers at once, in which
	 * case the junction owns the cursor rather than the individual groups.
	 */
	junctionId?: string;
};

export type ResizeEvent = KeyboardEvent | MouseEvent | TouchEvent;

/** How much of a resize to carry out, for when several are being carried out as one. */
export type ResizeOptions = {
	/**
	 * The share of what the event asks for to actually apply, between 0 and 1.
	 *
	 * Resizers dragged together have to agree on how far they can go, so each is asked for
	 * the share it could manage and they all move by the smallest of those.
	 *
	 * @defaultValue `1`
	 */
	share?: number;
	/** Work out what would happen without changing anything. */
	dryRun?: boolean;
};

/**
 * Carries out a resize, returning the share of what the event asked for that the panes could
 * actually take: `1` when all of it landed, and `0` when they had no room at all.
 */
export type ResizeHandler = (event: ResizeEvent, options?: ResizeOptions) => number;

export type PaneResizeHandleOnDragging = (isDragging: boolean) => void;

export type PaneJunctionOnDragging = (isDragging: boolean, junctionId: string) => void;

/**
 * A point where resizers travelling along opposing axes meet, and which drags all of them
 * at once.
 */
export type PaneJunctionData = {
	/** A stable id derived from the resizers the junction drives. */
	id: string;
	/** The center of the junction on the x axis, in viewport coordinates. */
	x: number;
	/** The center of the junction on the y axis, in viewport coordinates. */
	y: number;
	/** The width of the junction, matching the thickest resizer it moves along the x axis. */
	width: number;
	/** The height of the junction, matching the thickest resizer it moves along the y axis. */
	height: number;
	/**
	 * `"cross"` when perpendicular resizers meet the junction on both sides, `"tee"` when
	 * one resizer ends against another.
	 */
	type: "cross" | "tee";
	/**
	 * The junction's place in paint order. Junctions that overlap are independent of one
	 * another, and the one with the higher index sits on top and takes the pointer.
	 */
	index: number;
	/** Whether the junction is currently being dragged. */
	isDragging: boolean;
	/**
	 * The resizer the junction is rendered inside, where along it the junction sits, and
	 * which side the others arrive from.
	 */
	anchor: JunctionAnchor;
	/** The ids of the resizers the junction drives, per axis. */
	resizerIds: { x: string[]; y: string[] };
};

export type PaneJunctionChild = Snippet<
	[{ props: Record<string, unknown>; junction: PaneJunctionData }]
>;

export type PaneJunctionChildren = Snippet<[{ junction: PaneJunctionData }]>;

/** A junction handed to the group that renders it. */
export type HostedJunction = {
	junction: PaneJunctionData;
	props: Record<string, unknown>;
	child: PaneJunctionChild | undefined;
	children: PaneJunctionChildren | undefined;
};

export type RefAttachment<T extends HTMLElement = HTMLElement> = ReturnType<typeof attachRef<T>>;
