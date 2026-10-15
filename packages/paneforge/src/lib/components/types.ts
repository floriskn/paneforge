import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import type {
	Direction,
	PaneGroupUnits,
	PaneSize,
	PaneUnits,
	PaneJunctionData,
	PaneJunctionOnDragging,
	PaneOnCollapse,
	PaneOnExpand,
	PaneOnResize,
	PaneResizeHandleOnDragging,
} from "$lib/internal/types.js";
import type { PaneGroupStorage } from "$lib/internal/utils/storage.js";

type Primitive<T> = Omit<T, "id" | "children"> & { id?: string | undefined };

export type Without<T extends object, U extends object> = Omit<T, keyof U>;

export type WithChild<
	/**
	 * The props that the component accepts.
	 */
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	Props extends Record<PropertyKey, unknown> = {},
	/**
	 * The props that are passed to the `child` and `children` snippets. The `ElementProps` are
	 * merged with these props for the `child` snippet.
	 */
	SnippetProps extends Record<PropertyKey, unknown> = { _default: never },
	/**
	 * The underlying DOM element being rendered. You can bind to this prop to
	 * programmatically interact with the element.
	 */
	Ref = HTMLElement,
> = Omit<Props, "child" | "children"> & {
	child?: SnippetProps extends { _default: never }
		? Snippet<[{ props: Record<string, unknown> }]>
		: Snippet<[SnippetProps & { props: Record<string, unknown> }]>;
	children?: SnippetProps extends { _default: never } ? Snippet : Snippet<[SnippetProps]>;
	style?: string | null | undefined;
	ref?: Ref | null | undefined;
};

export type PaneForgePrimitiveDivAttributes = Primitive<HTMLAttributes<HTMLDivElement>>;

export type { Direction, PaneSize, PaneUnits, PaneGroupUnits };

/**
 * Every size on a pane is read in its own `units`: a share of the group by default, or pixels
 * when the pane is set to `units="pixels"`. A size can also name its own unit — `minSize="180px"`
 * — which is how a pane that takes a share of the group is given a limit in pixels.
 */
export type PanePropsWithoutHTML = WithChild<{
	/**
	 * The unit this pane is sized in, which is the unit every size on it is read in —
	 * `defaultSize`, `minSize`, `maxSize`, `collapsedSize`, and the sizes reported by
	 * `onResize` and `getSize`.
	 *
	 * A `percentage` pane takes a share of the group, so it follows the group as it resizes.
	 * A `pixels` pane is absolute: it keeps its size when the group changes size, and the
	 * difference is taken up by the panes sizing themselves as a share.
	 *
	 * Panes of both kinds can sit in the same group. Give a sidebar a size in pixels and
	 * leave the pane beside it alone, and the sidebar holds its width while its neighbour
	 * takes whatever is left.
	 *
	 * @defaultValue its group's `units`
	 */
	units?: PaneUnits;

	/**
	 * The size of the pane when it is in a collapsed state, in the pane's own units.
	 */
	collapsedSize?: number;

	/**
	 * Whether the pane can be collapsed.
	 *
	 * @defaultValue `false`
	 */
	collapsible?: boolean;

	/**
	 * The size the pane starts at, in its own units — or in the unit it names, as `"260px"`
	 * or `"40%"`.
	 *
	 * Leave it off and the pane takes an even share of whatever the panes that do have one
	 * have not claimed, which is how a pane is told to simply fill the space left over.
	 */
	defaultSize?: PaneSize;

	/**
	 * The largest the pane may be, in its own units — or in the unit it names, as `"480px"`
	 * or `"60%"`.
	 *
	 * @defaultValue the whole group
	 */
	maxSize?: PaneSize;

	/**
	 * The smallest the pane may be, in its own units — or in the unit it names, as `"180px"`
	 * or `"20%"`.
	 *
	 * A limit in pixels is the same limit whatever the group is doing, so a pane that takes a
	 * share of the group can still refuse to go below a width its contents need. A limit as a
	 * share moves with the group instead.
	 *
	 * @defaultValue `0`
	 */
	minSize?: PaneSize;

	/**
	 * The order of the pane in the group.
	 * Useful for maintaining order when conditionally rendering panes.
	 */
	order?: number;

	/**
	 * A callback that is called when the pane is collapsed.
	 */
	onCollapse?: PaneOnCollapse;

	/**
	 * A callback that is called when the pane is expanded.
	 */
	onExpand?: PaneOnExpand;

	/**
	 * A callback that is called when the pane is resized.
	 */
	onResize?: PaneOnResize;
}>;

export type PaneProps = PanePropsWithoutHTML &
	Without<PaneForgePrimitiveDivAttributes, PanePropsWithoutHTML>;

export type PaneGroupPropsWithoutHTML = WithChild<{
	/**
	 * The id to save the layout of the panes to in local storage.
	 */
	autoSaveId?: string | null;

	/**
	 * The direction of the panes.
	 *
	 * @required
	 */
	direction: Direction;

	/**
	 * The amount of space to add to the pane group when the keyboard
	 * resize event is triggered, in the group's `units`.
	 */
	keyboardResizeBy?: number | null;

	/**
	 * A callback called when the layout of the panes within the group changes. Each pane's
	 * size is given in its own units.
	 */
	onLayoutChange?: (layout: number[]) => void | null;

	/**
	 * The storage object to use for saving the layout of the panes in the group.
	 */
	storage?: PaneGroupStorage;

	/**
	 * The unit this group's panes are sized in, for the panes that do not say for themselves.
	 * Also the unit `keyboardResizeBy` is read in.
	 *
	 * Set it to size every pane in the group the same way. A single pane needing the other
	 * unit says so itself instead of the whole group changing.
	 *
	 * @defaultValue `"percentage"`
	 */
	units?: PaneUnits;

	/**
	 * Whether double clicking a resize handle gives every pane in the group the same size.
	 *
	 * Off by default. The same thing is available as `distributeEvenly()` on the group, so
	 * you can put it behind your own control instead.
	 *
	 * @defaultValue `false`
	 */
	evenOnDoubleClick?: boolean;

	/**
	 * Whether dividers in the groups nested directly inside this one are dragged together
	 * when they line up.
	 *
	 * Those groups keep their own sizes and stay independent. What changes is that two
	 * dividers sitting on the same line are treated as one: dragging either moves both, and
	 * double clicking either evens both out. They also go only as far as all of them can, so
	 * the line they form stays one line — where one reaches a pane's `minSize` is where both
	 * stop. Dividers that do not line up are left alone.
	 *
	 * This is worked out from where the dividers actually are each time a drag starts, so
	 * nothing is stored and nothing has to be kept in step.
	 *
	 * @defaultValue `false`
	 */
	align?: boolean;
}>;

export type PaneGroupProps = PaneGroupPropsWithoutHTML &
	Without<PaneForgePrimitiveDivAttributes, PaneGroupPropsWithoutHTML>;

export type PaneResizerPropsWithoutHTML = WithChild<{
	/**
	 * Whether the resize handle is disabled.
	 *
	 * @defaultValue `false`
	 */
	disabled?: boolean;

	/**
	 * A callback that is called when the resize handle is being dragged.
	 */
	onDraggingChange?: PaneResizeHandleOnDragging;

	/**
	 * The tabindex of the resize handle.
	 */
	tabindex?: number;
}>;

/**
 * A resizer renders the junctions anchored to it among its own children. When the `child`
 * snippet is used the resizer no longer renders an element of its own, so the `junctions`
 * snippet has to be rendered inside whatever element takes its place.
 */
export type PaneResizerPropsWithoutHTMLWithJunctions = Omit<
	PaneResizerPropsWithoutHTML,
	"child"
> & {
	child?: Snippet<
		[
			{
				props: Record<string, unknown>;
				junctions: Snippet;
				/**
				 * The ids of the resizers that would be dragged along with this one, because
				 * they line up with it. See
				 * [`align`](https://paneforge.com/docs/examples/aligned-grids).
				 *
				 * Measured when called, so it answers for right now: two dividers that have
				 * come apart are no longer linked.
				 */
				getLinkedIds: () => string[];
			},
		]
	>;
};

export type PaneResizerProps = PaneResizerPropsWithoutHTMLWithJunctions &
	Without<PaneForgePrimitiveDivAttributes, PaneResizerPropsWithoutHTMLWithJunctions>;

/**
 * A point where resizers travelling along opposing axes meet, and which drags all of them
 * at once.
 */
export type PaneJunction = PaneJunctionData;

export type PaneJunctionsPropsWithoutHTML = {
	/**
	 * Whether the junctions are disabled. The resizers they would drive remain usable on
	 * their own.
	 *
	 * @defaultValue `false`
	 */
	disabled?: boolean;

	/**
	 * How close, in pixels, resizers must come to count as meeting.
	 *
	 * @defaultValue `4`
	 */
	tolerance?: number;

	/**
	 * How close, in pixels, two parallel resizers must line up before the junctions they
	 * form become a single cross that drags them together.
	 *
	 * Deliberately tight: junctions that merely sit near each other stay independent, so
	 * dragging one never moves the other. Where their hit areas overlap, the one later in
	 * paint order takes the pointer.
	 *
	 * @defaultValue `0.5`
	 */
	crossTolerance?: number;

	/**
	 * A callback that is called when a junction's dragging state changes.
	 */
	onDraggingChange?: PaneJunctionOnDragging;

	/**
	 * Render your own element for each junction, using the props provided.
	 */
	child?: Snippet<[{ props: Record<string, unknown>; junction: PaneJunction }]>;

	/**
	 * Render the contents of each junction.
	 */
	children?: Snippet<[{ junction: PaneJunction }]>;

	style?: string | null | undefined;
};

/**
 * `PaneJunctions` renders one element per junction, so it takes no `id` or `ref` of its own.
 * Every other attribute is applied to each junction element.
 */
export type PaneJunctionsProps = PaneJunctionsPropsWithoutHTML &
	Without<Omit<PaneForgePrimitiveDivAttributes, "id">, PaneJunctionsPropsWithoutHTML>;

export type PaneAPI = {
	/* Collapse the pane to its minimum size */
	collapse: () => void;
	/* Expand the pane to its previous size */
	expand: () => void;
	/* Get the pane's id */
	getId: () => string;
	/** Get the panes size */
	getSize: () => number;
	/** Check if the pane is collapsed */
	isCollapsed: () => boolean;
	/** Check if the pane is expanded */
	isExpanded: () => boolean;
	/** Resize the pane to the specified size */
	resize: (size: number) => void;
};

export type PaneJunctionsAPI = {
	/** Get the junctions currently detected within the scoping group. */
	getJunctions: () => PaneJunction[];
};

export type PaneGroupAPI = {
	/** Get the ID of the PaneGroup */
	getId: () => string;
	/** Get the layout of the PaneGroup, with each pane's size in its own units */
	getLayout: () => number[];
	/** Set the layout of the PaneGroup, with each pane's size in its own units */
	setLayout: (layout: number[]) => void;
	/**
	 * Get the size the panes share out, in the unit the group works in: 100 while every pane
	 * takes a share of the group, and the pixels left over after the resizers once any pane
	 * is sized in pixels.
	 */
	getTotalSize: () => number;
	/**
	 * Give every pane in the group the same size. Panes that cannot take that size are held
	 * at their own limits and the rest is shared out among the panes that can.
	 */
	distributeEvenly: () => void;
};

/**
 * Data attributes applied to the element rendered by
 * the [Pane](https://paneforge.com/docs/components/pane) component.
 */
export type PaneAttributes = {
	/** Applied to every pane element. */
	"data-pane": string;
	/** The ID of the pane. */
	"data-pane-id": string;
	/** The ID of the pane's group. */
	"data-pane-group-id": string;
	/** The unit the pane is sized in. */
	"data-units": PaneUnits;
};

export type PaneGroupAttributes = {
	/** Applied to every pane group element. */
	"data-pane-group": string;
	/** The direction of the pane group. */
	"data-direction": Direction;
	/** The ID of the pane group. */
	"data-pane-group-id": string;
	/** The unit the group's panes are sized in unless they say for themselves. */
	"data-units": PaneUnits;
};

export type PaneResizerAttributes = {
	/** Applied to all resizer elements */
	"data-pane-resizer": string;
	/** The direction of the pane group the resize handle belongs to. */
	"data-direction": Direction;
	/** The ID of the pane group the resize handle belongs to. */
	"data-pane-group-id": string;
	/** Whether the resize handle is active or not. */
	"data-active"?: "pointer" | "keyboard";
	/** Whether the resize handle is enabled or not. */
	"data-enabled"?: boolean;
	/** The ID of the resize handle. */
	"data-pane-resizer-id": string;
};

/**
 * Data attributes applied to the elements rendered by
 * the [PaneJunctions](https://paneforge.com/docs/components/pane-junctions) component.
 */
export type PaneJunctionAttributes = {
	/** Applied to every junction element. */
	"data-pane-junction": string;
	/** The ID of the junction. */
	"data-pane-junction-id": string;
	/** The ID of the group the junctions are scoped to. */
	"data-pane-group-id": string;
	/** Whether perpendicular resizers meet the junction on both sides, or only one. */
	"data-junction-type": "cross" | "tee";
	/** Whether the junction is being dragged. */
	"data-active"?: "pointer";
	/** Whether the junction is enabled or not. */
	"data-enabled"?: boolean;
};
