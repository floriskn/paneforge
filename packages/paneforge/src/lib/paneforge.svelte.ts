import {
	type ReadableBoxedValues,
	type WithRefProps,
	addEventListener,
	executeCallbacks,
	mergeProps,
	afterTick,
	attachRef,
	DOMContext,
} from "svelte-toolbelt";
import { onMount, untrack } from "svelte";
import { Context, useResizeObserver, watch } from "runed";
import {
	callPaneCallbacks,
	findPaneDataIndex,
	fitLayoutToTotal,
	getDelta,
	getPivotIndices,
	getResizeEventCursorPosition,
	getResizeHandleElement,
	getResizeHandleElementIndex,
	getResizeHandleElementsForGroup,
	getResizeHandlePaneIds,
	getUnsafeDefaultLayout,
	noop,
	paneDataHelper,
	updateResizeHandleAriaValues,
	validatePaneGroupLayout,
} from "$lib/internal/helpers.js";
import { isKeyDown, isMouseEvent, isTouchEvent } from "$lib/internal/utils/is.js";
import { adjustLayoutByDelta } from "$lib/internal/utils/adjust-layout.js";
import { areArraysEqual, areNumbersAlmostEqual } from "$lib/internal/utils/compare.js";
import { PRECISION } from "$lib/internal/constants.js";
import {
	computePaneFlexBoxStyle,
	getCursorStyle,
	resetGlobalCursorStyle,
	setGlobalCursorStyle,
} from "$lib/internal/utils/style.js";
import { assert } from "$lib/internal/utils/assert.js";
import { resolvePaneSize } from "$lib/internal/utils/size.js";
import {
	computeJunctions,
	directionToJunctionAxis,
	type ComputedJunction,
	type JunctionCandidate,
} from "$lib/internal/utils/junctions.js";
import type {
	Direction,
	DragState,
	HostedJunction,
	PaneConstraints,
	PaneSize,
	PaneSizeConstraints,
	PaneSizeValue,
	PaneUnits,
	PaneJunctionData,
	PaneJunctionChild,
	PaneJunctionChildren,
	PaneJunctionOnDragging,
	PaneOnCollapse,
	PaneOnExpand,
	PaneOnResize,
	PaneResizeHandleOnDragging,
	PaneTransitionState,
	RefAttachment,
	ResizeEvent,
	ResizeHandler,
	ResizeOptions,
} from "$lib/internal/types.js";
import {
	type PaneGroupStorage,
	initializeStorage,
	loadPaneGroupState,
	updateStorageValues,
} from "$lib/internal/utils/storage.js";
import { on } from "svelte/events";
import type {
	FocusEventHandler,
	KeyboardEventHandler,
	MouseEventHandler,
	TouchEventHandler,
} from "svelte/elements";

export const defaultStorage: PaneGroupStorage = {
	getItem: (name: string) => {
		initializeStorage(defaultStorage);
		return defaultStorage.getItem(name);
	},
	setItem: (name: string, value: string) => {
		initializeStorage(defaultStorage);
		defaultStorage.setItem(name, value);
	},
};

const PaneGroupContext = new Context<PaneGroupState>("PaneGroup");

/**
 * How close two dividers have to be, in pixels, to count as lining up. Tight on purpose:
 * dividers that merely sit near one another are left independent.
 */
const ALIGNED_RESIZER_TOLERANCE = 1;

/** The middle of a resizer along the axis it travels on. */
function centerAcross(rect: DOMRect, direction: Direction): number {
	return direction === "horizontal" ? (rect.left + rect.right) / 2 : (rect.top + rect.bottom) / 2;
}

/**
 * Moves several resizers by one event, as far as all of them can go.
 *
 * Each is asked what the event would do to it and how much of that its panes could take. The
 * smallest share is what they can all manage, so it is what all of them do — otherwise the one
 * with room left runs on and dividers that were dragged as one line come apart the moment the
 * first of them reaches a pane's limit.
 */
function resizeTogether(resizers: PaneResizerState[], event: ResizeEvent) {
	if (resizers.length === 1) {
		resizers[0].resizeHandler?.(event);
		return;
	}

	let share = 1;
	for (const resizer of resizers) {
		share = Math.min(share, resizer.resizeHandler?.(event, { dryRun: true }) ?? 1);
		if (share === 0) break;
	}

	for (const resizer of resizers) resizer.resizeHandler?.(event, { share });
}

interface PaneGroupStateOpts
	extends WithRefProps,
		ReadableBoxedValues<{
			autoSaveId: string | null;
			direction: Direction;
			keyboardResizeBy: number | null;
			onLayout: (layout: number[]) => void | null;
			storage: PaneGroupStorage;
			units: PaneUnits;
			evenOnDoubleClick: boolean;
			align: boolean;
		}> {}

export class PaneGroupState {
	static create(opts: PaneGroupStateOpts) {
		// Read the enclosing group before overwriting the context, so nested groups can be
		// walked as a tree from any ancestor.
		return PaneGroupContext.set(new PaneGroupState(opts, PaneGroupContext.getOr(null)));
	}

	readonly opts: PaneGroupStateOpts;
	readonly attachment: RefAttachment;
	readonly domContext: DOMContext;
	/** The group this one is nested within, if any. */
	readonly parent: PaneGroupState | null;
	childGroups = $state.raw<PaneGroupState[]>([]);
	resizersArray = $state.raw<PaneResizerState[]>([]);
	/** The `PaneJunctions` scoped to this group itself. */
	ownJunctionLayers = $state.raw<PaneJunctionsState[]>([]);
	/**
	 * Space the panes have to share, in pixels. Only measured for a group holding a pane
	 * sized in pixels, which is the only kind that needs to know.
	 */
	#availableSize = $state<number>(0);
	/**
	 * The group's content box, as the resize observer last reported it.
	 *
	 * `clientWidth` and `clientHeight` are rounded to whole pixels, which is close enough to
	 * lay out a share of the group but not to land a pane exactly on a size given in pixels:
	 * half a pixel of a group spread across its panes is what leaves a 48px pane 48.02px wide.
	 * The observer reports the real fractional box, so it is preferred where there is one.
	 */
	#contentBox: { width: number; height: number } | null = null;
	dragState = $state.raw<DragState | null>(null);
	layout = $state.raw<number[]>([]);
	#lastNotifiedLayout: number[] = [];
	panesArray = $state.raw<PaneState[]>([]);
	panesArrayChanged = $state<boolean>(false);
	paneIdToLastNotifiedSizeMap = $state<Record<string, number>>({});
	paneSizeBeforeCollapseMap = new Map<string, number>();
	prevDelta = 0;

	constructor(opts: PaneGroupStateOpts, parent: PaneGroupState | null = null) {
		this.opts = opts;
		this.parent = parent;
		this.attachment = attachRef(this.opts.ref);
		this.domContext = new DOMContext(this.opts.ref);

		if (parent) {
			onMount(() => parent.registerChildGroup(this));
		}

		watch(
			[
				() => this.opts.id.current,
				() => this.layout,
				() => this.panesArray,
				() => this.total,
			],
			() => {
				return updateResizeHandleAriaValues({
					groupId: this.opts.id.current,
					layout: this.layout,
					panesArray: this.panesArray,
					paneConstraints: this.paneConstraints,
					domContext: this.domContext,
					total: this.total,
				});
			}
		);

		// A group with anything written in pixels has to know how much space it actually has
		// before it can size anything, and has to be told whenever that changes.
		useResizeObserver(
			() => {
				if (!this.#needsMeasurement) return [];
				const element = this.opts.ref.current;
				const resizerElements = this.resizersArray
					.map((resizer) => resizer.opts.ref.current)
					.filter(
						(resizerElement): resizerElement is HTMLElement => resizerElement !== null
					);
				return element ? [element, ...resizerElements] : resizerElements;
			},
			(entries) => this.#observe(entries)
		);

		$effect(() => {
			this.#measureAvailableSize();
		});

		watch([() => this.total, () => this.panesArray, () => this.#availableSize], () =>
			this.#refit()
		);

		$effect(() => {
			return untrack(() => {
				return this.#setResizeHandlerEventListeners();
			});
		});

		watch(
			[
				() => this.opts.autoSaveId.current,
				() => this.layout,
				() => this.opts.storage.current,
			],
			() => {
				if (!this.opts.autoSaveId.current) return;
				updateStorageValues({
					autoSaveId: this.opts.autoSaveId.current,
					layout: this.reportedLayout,
					storage: this.opts.storage.current,
					panesArray: this.panesArray,
					paneSizeBeforeCollapse: this.paneSizeBeforeCollapseMap,
				});
			}
		);

		watch([() => this.panesArrayChanged, () => this.total], () => {
			if (!this.panesArrayChanged) return;
			// A group sizing in pixels cannot lay anything out until it knows how much
			// space it has. The flag is left set, so this runs again on the measurement.
			if (this.total <= 0) return;
			this.panesArrayChanged = false;
			// const autoSaveId = this.opts.autoSaveId.current;
			// const storage = this.opts.storage.current;
			const prevLayout = this.layout;
			// const paneDataArray = this.panesArray;

			let unsafeLayout: number[] | null = null;

			if (this.opts.autoSaveId.current) {
				const state = loadPaneGroupState(
					this.opts.autoSaveId.current,
					this.panesArray,
					this.opts.storage.current
				);
				if (state) {
					this.paneSizeBeforeCollapseMap = new Map(Object.entries(state.expandToSizes));
					unsafeLayout = this.#toLayoutUnits(state.layout);
				}
			}

			if (unsafeLayout == null) {
				unsafeLayout = getUnsafeDefaultLayout({
					paneConstraints: this.paneConstraints,
					total: this.total,
				});
			}

			const nextLayout = validatePaneGroupLayout({
				layout: unsafeLayout,
				paneConstraints: this.paneConstraints,
				total: this.total,
				absolute: this.#absolute,
			});

			if (areArraysEqual(prevLayout, nextLayout)) return;

			this.#applyLayout(nextLayout);
		});
	}

	/**
	 * This group and every group nested within it, at any depth.
	 *
	 * Junctions are formed by resizers that may live many levels apart in the tree, so they
	 * are resolved against the whole subtree rather than a single group.
	 */
	readonly groupsInScope: PaneGroupState[] = $derived.by(() => [
		this,
		...this.childGroups.flatMap((group) => group.groupsInScope),
	]);

	registerChildGroup = (group: PaneGroupState) => {
		this.childGroups = [...this.childGroups, group];

		return () => {
			this.childGroups = this.childGroups.filter((childGroup) => childGroup !== group);
		};
	};

	registerResizer = (resizer: PaneResizerState) => {
		this.resizersArray = [...this.resizersArray, resizer];

		return () => {
			this.resizersArray = this.resizersArray.filter(
				(groupResizer) => groupResizer !== resizer
			);
		};
	};

	registerJunctionLayer = (layer: PaneJunctionsState) => {
		this.ownJunctionLayers = [...this.ownJunctionLayers, layer];

		return () => {
			this.ownJunctionLayers = this.ownJunctionLayers.filter(
				(ownLayer) => ownLayer !== layer
			);
		};
	};

	/** Every `PaneJunctions` whose scope reaches this group, including from above it. */
	readonly junctionLayers: PaneJunctionsState[] = $derived.by(() => [
		...(this.parent?.junctionLayers ?? []),
		...this.ownJunctionLayers,
	]);

	/** The unit each pane is sized in: its own, or the group's where it has none. */
	readonly paneUnits: PaneUnits[] = $derived.by(() => this.panesArray.map((pane) => pane.units));

	/**
	 * Whether any pane in the group holds an absolute size.
	 *
	 * One pane sized in pixels is enough to make the whole layout absolute: shares and
	 * absolute sizes cannot be added together, so the group works in pixels and converts each
	 * pane's share to and from them. A group with no pixel panes never measures itself and
	 * works in percentages throughout, exactly as it always has.
	 */
	readonly hasPixelPanes = $derived.by(() => this.paneUnits.includes("pixels"));

	/** The unit this group keeps its layout in. */
	readonly layoutUnits: PaneUnits = $derived.by(() =>
		this.hasPixelPanes ? "pixels" : "percentage"
	);

	/**
	 * The size the panes share out, in the unit the layout is kept in.
	 *
	 * A percentage layout always shares out 100. A pixel layout shares out the space actually
	 * available to the panes, which is the group minus its resizers.
	 */
	readonly total = $derived.by(() => (this.hasPixelPanes ? this.#availableSize : 100));

	/**
	 * What each pane's own sizes are multiplied by to reach the unit the layout is kept in.
	 *
	 * Pixels are already that unit; a percentage is a share of the whole group, so one
	 * percent is a hundredth of the total.
	 */
	readonly #scales: number[] = $derived.by(() => {
		if (!this.hasPixelPanes) return this.paneUnits.map(() => 1);
		const perPercent = this.total / 100;
		return this.paneUnits.map((units) => (units === "pixels" ? 1 : perPercent));
	});

	/** Guarded against a group that has not measured itself, where the scale is zero. */
	#scaleAt = (index: number): number => this.#scales[index] || 1;

	/**
	 * Which panes hold an absolute size, and so keep it when the group changes size rather
	 * than absorbing the difference.
	 */
	readonly #absolute: boolean[] = $derived.by(() =>
		this.paneUnits.map((units) => this.hasPixelPanes && units === "pixels")
	);

	/**
	 * Whether any pane is held to a limit written in pixels while the layout is kept in
	 * shares, which is the one case where a share has to be worked out from a measurement
	 * even though nothing in the group is sized absolutely.
	 */
	readonly #hasPixelLimits = $derived.by(
		() =>
			!this.hasPixelPanes &&
			this.panesArray.some((pane) => {
				const { minSize, maxSize, defaultSize } = pane.constraints;
				return (
					minSize?.units === "pixels" ||
					maxSize?.units === "pixels" ||
					defaultSize?.units === "pixels"
				);
			})
	);

	/** Whether the group has to know its own size in pixels to lay its panes out. */
	readonly #needsMeasurement = $derived.by(() => this.hasPixelPanes || this.#hasPixelLimits);

	/**
	 * A size written in its own unit, in the unit the layout is kept in.
	 *
	 * A pixel size among shares is the only one that needs a measurement, and until there is
	 * one it cannot be placed at all — so it is left out rather than guessed at, which for a
	 * limit means the pane is simply unbounded for the one frame before the group is measured.
	 */
	#toLayoutSize = (size: PaneSizeValue | undefined): number | undefined => {
		if (size == null) return undefined;

		if (this.hasPixelPanes) {
			return size.units === "pixels" ? size.value : (size.value / 100) * this.total;
		}

		if (size.units === "percentage") return size.value;

		const available = this.#availableSize;
		return available > 0 ? (size.value / available) * 100 : undefined;
	};

	/**
	 * The groups inside this one that run the other way, so their dividers cross it and can
	 * line up with one another.
	 */
	readonly alignedGroups: PaneGroupState[] = $derived.by(() =>
		this.opts.align.current
			? this.childGroups.filter(
					(group) => group.opts.direction.current !== this.opts.direction.current
				)
			: []
	);

	/**
	 * The resizers that should move along with the given one, because they currently line up
	 * with it.
	 *
	 * Groups keep their own sizes: this is worked out afresh each time a drag starts, from
	 * where the dividers actually are. Two that line up are dragged together, and two that do
	 * not are left alone — so they stay linked only for as long as they agree.
	 */
	linkedResizersFor = (resizer: PaneResizerState): PaneResizerState[] => {
		const parent = this.parent;
		if (!parent || !parent.alignedGroups.includes(this)) return [];

		const element = resizer.opts.ref.current;
		if (!element) return [];

		const direction = this.opts.direction.current;
		const position = centerAcross(element.getBoundingClientRect(), direction);
		const linked: PaneResizerState[] = [];

		for (const group of parent.alignedGroups) {
			if (group === this) continue;
			if (group.opts.direction.current !== direction) continue;

			for (const peer of group.resizersArray) {
				if (peer.opts.disabled.current) continue;

				const peerElement = peer.opts.ref.current;
				if (!peerElement) continue;

				const peerPosition = centerAcross(peerElement.getBoundingClientRect(), direction);
				if (Math.abs(peerPosition - position) > ALIGNED_RESIZER_TOLERANCE) continue;

				// A group drags one resizer at a time, so the first match is the one.
				linked.push(peer);
				break;
			}
		}

		return linked;
	};

	/** Every pane's constraints, converted into the unit the layout is kept in. */
	readonly paneConstraints: PaneConstraints[] = $derived.by(() =>
		this.panesArray.map((pane, index) => {
			const { collapsedSize, collapsible, defaultSize, maxSize, minSize } = pane.constraints;

			return {
				collapsible,
				// A collapsed size is only ever read in the pane's own units, so it follows
				// the pane rather than naming a unit of its own.
				collapsedSize:
					collapsedSize == null ? undefined : collapsedSize * this.#scaleAt(index),
				defaultSize: this.#toLayoutSize(defaultSize),
				maxSize: this.#toLayoutSize(maxSize),
				minSize: this.#toLayoutSize(minSize),
			};
		})
	);

	/**
	 * The layout with every pane's size in its own units, which is what the outside sees:
	 * pixels for a pane sized in them, and a share of the group for the rest.
	 */
	readonly reportedLayout: number[] = $derived.by(() =>
		this.layout.map((size, index) => {
			const scale = this.#scaleAt(index);
			if (scale === 1) return size;
			// Rounded, so converting back out of the layout's unit does not report sizes
			// carrying the remains of a division.
			return Number.parseFloat((size / scale).toFixed(PRECISION));
		})
	);

	/** A layout given in each pane's own units, in the unit the layout is kept in. */
	#toLayoutUnits = (sizes: number[]) => sizes.map((size, index) => size * this.#scaleAt(index));

	/**
	 * Takes a new layout, reports it, and tells the panes their new sizes.
	 *
	 * Sizes must be in the unit the layout is kept in. Both the layout that is reported and
	 * the sizes the panes are told are in each pane's own units.
	 */
	#applyLayout = (nextLayout: number[]) => {
		this.layout = nextLayout;
		this.#notifyLayout();
		callPaneCallbacks(this.panesArray, this.reportedLayout, this.paneIdToLastNotifiedSizeMap);
	};

	#notifyLayout = () => {
		const reported = this.reportedLayout;
		if (areArraysEqual(this.#lastNotifiedLayout, reported)) return;
		this.#lastNotifiedLayout = reported;
		this.opts.onLayout.current?.(reported);
	};

	/**
	 * The keyboard step, in the unit the layout is kept in. It is given in the group's own
	 * `units`, which is not the layout's unit when a group sizing in percentages holds a pane
	 * sized in pixels.
	 */
	readonly #keyboardResizeBy = $derived.by(() => {
		const step = this.opts.keyboardResizeBy.current;
		if (step == null) return null;
		if (!this.hasPixelPanes || this.opts.units.current === "pixels") return step;
		return step * (this.total / 100);
	});

	/** Takes the group's real content box off the observer, then measures again. */
	#observe = (entries: readonly { target: Element; contentRect: DOMRectReadOnly }[]) => {
		const element = this.opts.ref.current;

		for (const entry of entries ?? []) {
			if (entry.target !== element) continue;
			// `contentRect` is the content box itself, in the element's own width and height
			// rather than its writing mode's, and carries the fraction a client size drops.
			this.#contentBox = { width: entry.contentRect.width, height: entry.contentRect.height };
		}

		this.#measureAvailableSize();
	};

	#measureAvailableSize = () => {
		if (!this.#needsMeasurement) return;

		const element = this.opts.ref.current;
		if (!element) return;

		const isHorizontal = this.opts.direction.current === "horizontal";
		const contentBox = this.#contentBox;
		const groupSize = contentBox
			? isHorizontal
				? contentBox.width
				: contentBox.height
			: // Nothing observed yet, which lasts until the observer's first report.
				isHorizontal
				? element.clientWidth
				: element.clientHeight;

		// The resizers take their space out of the group before the panes divide the rest.
		// Measured from their boxes rather than their offset sizes, for the same fraction.
		let resizerSize = 0;
		for (const resizer of this.resizersArray) {
			const resizerElement = resizer.opts.ref.current;
			if (!resizerElement) continue;
			const rect = resizerElement.getBoundingClientRect();
			resizerSize += isHorizontal ? rect.width : rect.height;
		}

		this.#availableSize = Math.max(0, groupSize - resizerSize);
	};

	/**
	 * Keeps the layout fitting the group as it changes size.
	 *
	 * A layout of nothing but shares follows the group on its own, and is only looked at again
	 * when one of its limits was written in pixels — which is a different share at every group
	 * size. A layout holding an absolute size is refitted outright, and one for a group whose
	 * size is not known yet starts from its defaults instead.
	 */
	#refit = () => {
		const total = this.total;
		if (!this.#needsMeasurement || total <= 0) return;

		const panesArray = this.panesArray;
		if (panesArray.length === 0) return;

		const paneConstraints = this.paneConstraints;
		const absolute = this.#absolute;
		const prevLayout = this.layout;
		const sized =
			prevLayout.length === panesArray.length && prevLayout.some((size) => size > 0);

		// Nothing has been laid out yet. A group sizing in shares is seen to by the defaults,
		// which do not need a measurement; one sizing in pixels could not start until now.
		if (!sized && !this.hasPixelPanes) return;

		const unsafeLayout = !sized
			? getUnsafeDefaultLayout({ paneConstraints, total })
			: this.hasPixelPanes
				? fitLayoutToTotal({ layout: prevLayout, paneConstraints, total, absolute })
				: // Shares already fit; what may no longer fit are the limits in pixels.
					prevLayout;

		const nextLayout = validatePaneGroupLayout({
			layout: unsafeLayout,
			paneConstraints,
			total,
			absolute,
		});

		if (areArraysEqual(prevLayout, nextLayout)) return;

		this.#applyLayout(nextLayout);
	};

	/**
	 * Gives every pane in the group the same size.
	 *
	 * The share each pane gets is the group total over the number of panes, so this reads
	 * the same in either unit: 25 percent each, or a quarter of the available pixels each.
	 * Panes that cannot take that size are held at their own limits, and the rest is shared
	 * out among the panes that can.
	 */
	distributeEvenly = () => {
		const panesArray = this.panesArray;
		const total = this.total;

		if (panesArray.length === 0 || total <= 0) return;

		const paneConstraints = this.paneConstraints;
		const evenSize = total / panesArray.length;

		const nextLayout = validatePaneGroupLayout({
			layout: panesArray.map(() => evenSize),
			paneConstraints,
			total,
			absolute: this.#absolute,
		});

		if (areArraysEqual(this.layout, nextLayout)) return;

		this.#applyLayout(nextLayout);
	};

	/** Takes a layout with every pane's size in its own units. */
	setLayout = (newLayout: number[]) => {
		this.layout = this.#toLayoutUnits(newLayout);
	};

	registerResizeHandle = (dragHandleId: string): ResizeHandler => {
		return (event: ResizeEvent, options?: ResizeOptions): number => {
			event.preventDefault();

			const { share = 1, dryRun = false } = options ?? {};

			const direction = this.opts.direction.current;
			const dragState = this.dragState;
			const groupId = this.opts.id.current;
			const keyboardResizeBy = this.#keyboardResizeBy;

			const prevLayout = this.layout;

			const { initialLayout } = dragState ?? {};
			const doc = this.domContext.getDocument();

			const pivotIndices = getPivotIndices({
				groupId,
				dragHandleId,
				domContext: this.domContext,
			});

			let requested = getDelta({
				event: event,
				dragHandleId,
				dir: direction,
				initialDragState: dragState,
				keyboardResizeBy,
				domContext: this.domContext,
				units: this.layoutUnits,
				total: this.total,
			});
			// Nothing was asked for, so nothing was withheld.
			if (requested === 0) return 1;

			// support RTL
			const isHorizontal = direction === "horizontal";
			if (doc.dir === "rtl" && isHorizontal) {
				requested = -requested;
			}

			const delta = requested * share;
			const paneConstraints = this.paneConstraints;
			const baseLayout = initialLayout ?? prevLayout;

			const nextLayout = adjustLayoutByDelta({
				delta,
				layout: baseLayout,
				paneConstraints,
				pivotIndices,
				trigger: isKeyDown(event) ? "keyboard" : "mouse-or-touch",
				total: this.total,
			});
			const layoutChanged = !areArraysEqual(prevLayout, nextLayout);

			// How much of what was asked for actually landed. The pane before the divider grows
			// by the delta, so the difference across it is the answer, and a drag that went
			// nowhere gives zero.
			const pivot = pivotIndices[0];
			const moved = (nextLayout[pivot] ?? 0) - (baseLayout[pivot] ?? 0);
			const taken = Math.min(1, Math.max(0, moved / requested));

			if (dryRun) return taken;

			// Only update the cursor for layout changes triggered by touch/mouse events (not keyboard)
			// Update the cursor even if the layout hasn't changed (we may need to show an invalid cursor state)
			// While a junction drives several groups at once it owns the cursor. Letting each
			// group set its own would flip between the horizontal and vertical resize cursors
			// on every move.
			if ((isMouseEvent(event) || isTouchEvent(event)) && dragState?.junctionId == null) {
				// Watch for multiple subsequent deltas; this might occur for tiny cursor movements.
				// In this case, Pane sizes might not change–
				// but updating cursor in this scenario would cause a flicker.
				const prevDelta = this.prevDelta;
				if (prevDelta !== delta) {
					this.prevDelta = delta;

					if (!layoutChanged) {
						// If the pointer has moved too far to resize the pane any further,
						// update the cursor style for a visual clue.
						// This mimics VS Code behavior.

						if (isHorizontal) {
							setGlobalCursorStyle(
								delta < 0 ? "horizontal-min" : "horizontal-max",
								doc
							);
						} else {
							setGlobalCursorStyle(delta < 0 ? "vertical-min" : "vertical-max", doc);
						}
					} else {
						setGlobalCursorStyle(isHorizontal ? "horizontal" : "vertical", doc);
					}
				}
			}
			if (layoutChanged) this.#applyLayout(nextLayout);

			return taken;
		};
	};

	/** Takes a size in the pane's own units. */
	resizePane = (paneState: PaneState, unsafePaneSize: number) => {
		const prevLayout = this.layout;
		const panesArray = this.panesArray;

		const paneConstraintsArr = this.paneConstraints;

		const paneIndex = findPaneDataIndex(panesArray, paneState);
		const { paneSize, pivotIndices } = paneDataHelper(
			panesArray,
			paneConstraintsArr,
			paneState,
			prevLayout
		);

		assert(paneSize != null);

		const requestedSize = unsafePaneSize * this.#scaleAt(paneIndex);
		const isLastPane = paneIndex === panesArray.length - 1;

		const delta = isLastPane ? paneSize - requestedSize : requestedSize - paneSize;

		const nextLayout = adjustLayoutByDelta({
			delta,
			layout: prevLayout,
			paneConstraints: paneConstraintsArr,
			pivotIndices,
			trigger: "imperative-api",
			total: this.total,
		});

		if (areArraysEqual(prevLayout, nextLayout)) return;

		this.#applyLayout(nextLayout);
	};

	startDragging = (dragHandleId: string, e: ResizeEvent, junctionId?: string) => {
		const direction = this.opts.direction.current;
		const layout = this.layout;

		const handleElement = getResizeHandleElement(dragHandleId, this.domContext);

		assert(handleElement);

		const initialCursorPosition = getResizeEventCursorPosition(direction, e);

		this.dragState = {
			dragHandleId,
			dragHandleRect: handleElement.getBoundingClientRect(),
			initialCursorPosition,
			initialLayout: layout,
			junctionId,
		};
	};

	stopDragging = () => {
		resetGlobalCursorStyle();
		this.dragState = null;
	};

	isPaneCollapsed = (pane: PaneState) => {
		const paneDataArray = this.panesArray;
		const layout = this.layout;
		const {
			collapsedSize = 0,
			collapsible,
			paneSize,
		} = paneDataHelper(paneDataArray, this.paneConstraints, pane, layout);

		// On init the value may be undefined, so we need to check for that
		if (typeof paneSize !== "number" || typeof collapsedSize !== "number") return false;

		return collapsible === true && areNumbersAlmostEqual(paneSize, collapsedSize);
	};

	expandPane = (pane: PaneState) => {
		const prevLayout = this.layout;
		const paneDataArray = this.panesArray;

		if (!pane.constraints.collapsible) return;
		const paneConstraintsArray = this.paneConstraints;

		const {
			collapsedSize = 0,
			paneSize,
			minSize = 0,
			pivotIndices,
		} = paneDataHelper(paneDataArray, paneConstraintsArray, pane, prevLayout);

		if (paneSize !== collapsedSize) return;
		// restore this pane to the size it was before it was collapsed, if possible.
		const prevPaneSize = this.paneSizeBeforeCollapseMap.get(pane.opts.id.current);
		const baseSize = prevPaneSize != null && prevPaneSize >= minSize ? prevPaneSize : minSize;

		const isLastPane = findPaneDataIndex(paneDataArray, pane) === paneDataArray.length - 1;
		const delta = isLastPane ? paneSize - baseSize : baseSize - paneSize;

		const nextLayout = adjustLayoutByDelta({
			delta,
			layout: prevLayout,
			paneConstraints: paneConstraintsArray,
			pivotIndices,
			trigger: "imperative-api",
			total: this.total,
		});

		if (areArraysEqual(prevLayout, nextLayout)) return;

		this.#applyLayout(nextLayout);
	};

	collapsePane = (pane: PaneState) => {
		const prevLayout = this.layout;
		const paneDataArray = this.panesArray;

		if (!pane.constraints.collapsible) return;

		const paneConstraintsArray = this.paneConstraints;

		const {
			collapsedSize = 0,
			paneSize,
			pivotIndices,
		} = paneDataHelper(paneDataArray, paneConstraintsArray, pane, prevLayout);

		assert(paneSize != null);

		if (paneSize === collapsedSize) return;

		// Store the size before collapse, which is returned when `expand()` is called
		this.paneSizeBeforeCollapseMap.set(pane.opts.id.current, paneSize);

		const isLastPane = findPaneDataIndex(paneDataArray, pane) === paneDataArray.length - 1;
		const delta = isLastPane ? paneSize - collapsedSize : collapsedSize - paneSize;

		const nextLayout = adjustLayoutByDelta({
			delta,
			layout: prevLayout,
			paneConstraints: paneConstraintsArray,
			pivotIndices,
			trigger: "imperative-api",
			total: this.total,
		});

		if (areArraysEqual(prevLayout, nextLayout)) return;

		this.#applyLayout(nextLayout);
	};

	/** The pane's size in its own units. */
	getPaneSize = (pane: PaneState) => {
		return this.reportedLayout[findPaneDataIndex(this.panesArray, pane)];
	};

	getPaneStyle = (pane: PaneState) => {
		const paneIndex = findPaneDataIndex(this.panesArray, pane);
		const size = this.reportedLayout[paneIndex];
		const { defaultSize, minSize, maxSize, collapsible } = pane.constraints;

		// Each pane is laid out in its own unit: an absolute size becomes a basis, and a share
		// becomes a grow weight. Before there is a layout the pane is laid out from its own
		// default instead, in whichever unit that was written in — so a pane told to start at
		// 260px is 260px wide in the markup the server sends, share or not.
		return computePaneFlexBoxStyle({
			size,
			defaultSize: defaultSize?.value,
			units: size == null ? (defaultSize?.units ?? pane.units) : pane.units,
			paneCount: this.panesArray.length,
			dragState: this.dragState,
			direction: this.opts.direction.current,
			// A limit written in pixels is given to flex as well, which holds the pane there
			// exactly. A collapsible pane is left out of the floor: its smallest size is its
			// collapsed size, and a floor would stop it ever reaching it.
			minPixels: collapsible || minSize?.units !== "pixels" ? undefined : minSize.value,
			maxPixels: maxSize?.units === "pixels" ? maxSize.value : undefined,
		});
	};

	isPaneExpanded = (pane: PaneState) => {
		const {
			collapsedSize = 0,
			collapsible,
			paneSize,
		} = paneDataHelper(this.panesArray, this.paneConstraints, pane, this.layout);
		return !collapsible || paneSize > collapsedSize;
	};

	registerPane = (pane: PaneState) => {
		const newPaneDataArray = [...this.panesArray, pane];
		newPaneDataArray.sort((paneA, paneB) => {
			const orderA = paneA.opts.order.current;
			const orderB = paneB.opts.order.current;

			if (orderA == null && orderB == null) {
				return 0;
			} else if (orderA == null) {
				return -1;
			} else if (orderB == null) {
				return 1;
			} else {
				return orderA - orderB;
			}
		});
		this.panesArray = newPaneDataArray;
		this.panesArrayChanged = true;

		return () => {
			const paneDataArray = [...this.panesArray];
			const index = findPaneDataIndex(this.panesArray, pane);

			if (index < 0) return;
			paneDataArray.splice(index, 1);
			this.panesArray = paneDataArray;
			delete this.paneIdToLastNotifiedSizeMap[pane.opts.id.current];
			this.panesArrayChanged = true;
		};
	};

	#setResizeHandlerEventListeners = () => {
		const groupId = this.opts.id.current;
		const handles = getResizeHandleElementsForGroup(groupId, this.domContext);
		const paneDataArray = this.panesArray;

		const unsubHandlers = handles.map((handle) => {
			const handleId = handle.getAttribute("data-pane-resizer-id");
			if (!handleId) return noop;

			const [idBefore, idAfter] = getResizeHandlePaneIds({
				groupId,
				handleId,
				panesArray: paneDataArray,
				domContext: this.domContext,
			});

			if (idBefore == null || idAfter == null) return noop;

			const onKeydown = (e: KeyboardEvent) => {
				if (e.defaultPrevented || e.key !== "Enter") return;

				e.preventDefault();
				const paneDataArray = this.panesArray;
				const index = paneDataArray.findIndex(
					(paneData) => paneData.opts.id.current === idBefore
				);

				if (index < 0) return;

				const paneConstraints = this.paneConstraints;
				const layout = this.layout;

				const size = layout[index];

				// The group's own constraints, so they are in the same unit as the layout.
				const constraints = paneConstraints[index];
				assert(constraints);
				const { collapsedSize = 0, collapsible, minSize = 0 } = constraints;

				if (!(size != null && collapsible)) return;

				const nextLayout = adjustLayoutByDelta({
					delta: areNumbersAlmostEqual(size, collapsedSize)
						? minSize - size
						: collapsedSize - size,
					layout,
					paneConstraints,
					pivotIndices: getPivotIndices({
						groupId,
						dragHandleId: handleId,
						domContext: this.domContext,
					}),
					trigger: "keyboard",
					total: this.total,
				});

				if (!areArraysEqual(layout, nextLayout)) this.#applyLayout(nextLayout);
			};

			const unsubListener = addEventListener(handle, "keydown", onKeydown);

			return () => {
				unsubListener();
			};
		});

		return () => {
			for (const unsub of unsubHandlers) {
				unsub();
			}
		};
	};

	readonly props = $derived.by(
		() =>
			({
				id: this.opts.id.current,
				"data-pane-group": "",
				"data-direction": this.opts.direction.current,
				"data-units": this.opts.units.current,
				"data-pane-group-id": this.opts.id.current,
				style: {
					display: "flex",
					flexDirection: this.opts.direction.current === "horizontal" ? "row" : "column",
					height: "100%",
					overflow: "hidden",
					width: "100%",
				},
				...this.attachment,
			}) as const
	);
}

interface PaneResizerStateOpts
	extends WithRefProps,
		ReadableBoxedValues<{
			onDraggingChange: PaneResizeHandleOnDragging;
			disabled: boolean;
			tabIndex: number;
		}> {}

const resizeKeys = ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home"];

export class PaneResizerState {
	static create(opts: PaneResizerStateOpts) {
		return new PaneResizerState(opts, PaneGroupContext.get());
	}
	readonly opts: PaneResizerStateOpts;
	readonly group: PaneGroupState;
	readonly attachment: RefAttachment;
	readonly domContext: DOMContext;

	readonly #isDragging = $derived.by(
		() => this.group.dragState?.dragHandleId === this.opts.id.current
	);

	/**
	 * The junctions rendered inside this resizer. A junction always sits at the end of one
	 * of its resizers, and flex already puts that resizer in the right place, so anchoring
	 * to it fixes both coordinates without measuring either.
	 */
	readonly hostedJunctions: HostedJunction[] = $derived.by(() =>
		this.group.junctionLayers.flatMap((layer) => layer.junctionsFor(this))
	);
	#isFocused = $state(false);
	#notifiedDragging = false;
	/**
	 * The resizers this one is moving along with, itself included, set when the drag starts.
	 *
	 * Empty unless something is moving several at once. The resizer that was grabbed holds the
	 * whole set and moves all of them together; the others are marked as driven and do nothing
	 * of their own, so the set moves as far as all of them can rather than each going its own
	 * way.
	 */
	#movingTogether: PaneResizerState[] = [];
	/** Set while another resizer, or a junction, is the one moving this resizer. */
	#driven = false;
	resizeHandler: ResizeHandler | null = null;

	constructor(opts: PaneResizerStateOpts, group: PaneGroupState) {
		this.opts = opts;
		this.group = group;
		this.attachment = attachRef(this.opts.ref);
		this.domContext = new DOMContext(this.opts.ref);

		onMount(() => group.registerResizer(this));

		$effect(() => {
			if (this.opts.disabled.current) {
				this.resizeHandler = null;
			} else {
				this.resizeHandler = this.group.registerResizeHandle(this.opts.id.current);
			}
		});

		$effect(() => {
			const node = this.opts.ref.current;
			if (!node) return;
			const disabled = this.opts.disabled.current;
			const resizeHandler = this.resizeHandler;
			const isDragging = this.#isDragging;
			if (disabled || resizeHandler === null || !isDragging) return;

			const onMove = (e: ResizeEvent) => {
				this.resize(e);
			};

			const onMouseLeave = (e: ResizeEvent) => {
				this.resize(e);
			};

			const stopDraggingAndBlur = () => {
				node.blur();
				this.group.stopDragging();
				this.setDragging(false);
			};
			const domBody = this.domContext.getDocument().body;
			const domWindow = this.domContext.getWindow();

			return executeCallbacks(
				on(domBody, "contextmenu", stopDraggingAndBlur),
				on(domBody, "mousemove", onMove),
				on(domBody, "touchmove", onMove, { passive: false }),
				on(domBody, "mouseleave", onMouseLeave),
				on(domWindow, "mouseup", stopDraggingAndBlur),
				on(domWindow, "touchend", stopDraggingAndBlur)
			);
		});
	}

	/**
	 * Reports a change in dragging state, and only when it actually changed.
	 *
	 * A drag can be started and stopped by this resizer or by a junction driving it, and both
	 * report through here, so whoever gets there second is a no-op rather than a second
	 * notification.
	 */
	setDragging = (isDragging: boolean) => {
		if (!isDragging) {
			this.#movingTogether = [];
			this.#driven = false;
		}

		if (this.#notifiedDragging === isDragging) return;
		this.#notifiedDragging = isDragging;
		this.opts.onDraggingChange.current(isDragging);
	};

	/**
	 * Hands this resizer over to something else for the rest of the drag, which is what lets a
	 * junction move several resizers as one set rather than each moving itself.
	 */
	setDriven = (driven: boolean) => {
		this.#driven = driven;
	};

	/** Carries out a resize, together with anything this resizer is moving along with. */
	resize = (e: ResizeEvent) => {
		if (this.#driven) return;
		if (this.#movingTogether.length > 0) {
			resizeTogether(this.#movingTogether, e);
			return;
		}
		this.resizeHandler?.(e);
	};

	/**
	 * The ids of the resizers that would be dragged along with this one.
	 *
	 * Worked out from where the dividers actually are, so it answers for right now: two that
	 * line up travel together, and the same two stop being linked once they come apart.
	 */
	getLinkedIds = (): string[] =>
		this.group.linkedResizersFor(this).map((resizer) => resizer.opts.id.current);

	#startDragging = (e: MouseEvent | TouchEvent) => {
		e.preventDefault();

		if (this.opts.disabled.current) return;

		// Dividers alongside this one that line up with it move with it, as one set: this
		// resizer drives them all from the same pointer event, and they go as far as all of
		// them can, so they stay in one line instead of the one with room running on alone.
		const linked = this.group.linkedResizersFor(this);

		for (const peer of linked) {
			peer.group.startDragging(peer.opts.id.current, e);
			peer.setDragging(true);
			peer.setDriven(true);
		}

		this.group.startDragging(this.opts.id.current, e);
		this.setDragging(true);
		this.#movingTogether = linked.length > 0 ? [this, ...linked] : [];
	};

	#stopDraggingAndBlur = () => {
		const node = this.opts.ref.current;
		if (!node) return;
		node.blur();
		this.group.stopDragging();
		this.setDragging(false);
	};

	#onkeydown: KeyboardEventHandler<HTMLElement> = (e) => {
		if (this.opts.disabled.current || !this.resizeHandler || e.defaultPrevented) return;

		if (resizeKeys.includes(e.key)) {
			e.preventDefault();

			const linked = this.group.linkedResizersFor(this);
			resizeTogether(linked.length > 0 ? [this, ...linked] : [this], e);
			return;
		}

		if (e.key !== "F6") return;

		e.preventDefault();

		const handles = getResizeHandleElementsForGroup(
			this.group.opts.id.current,
			this.domContext
		);
		const index = getResizeHandleElementIndex({
			groupId: this.group.opts.id.current,
			id: this.opts.id.current,
			domContext: this.domContext,
		});

		if (index === null) return;

		let nextIndex = 0;

		if (e.shiftKey) {
			// Moving backwards
			if (index > 0) {
				nextIndex = index - 1;
			} else {
				nextIndex = handles.length - 1;
			}
		} else {
			// Moving forwards
			if (index + 1 < handles.length) {
				nextIndex = index + 1;
			} else {
				nextIndex = 0;
			}
		}

		const nextHandle = handles[nextIndex];
		nextHandle.focus();
	};

	#onblur: FocusEventHandler<HTMLElement> = () => {
		this.#isFocused = false;
	};

	#onfocus: FocusEventHandler<HTMLElement> = () => {
		this.#isFocused = true;
	};

	#onmousedown: MouseEventHandler<HTMLElement> = (e) => {
		this.#startDragging(e);
	};

	#ondblclick: MouseEventHandler<HTMLElement> = (e) => {
		if (this.opts.disabled.current || e.defaultPrevented) return;
		if (!this.group.opts.evenOnDoubleClick.current) return;

		e.preventDefault();

		// Evening out leaves the dividers where they started, so anything linked to this one
		// is evened too rather than being left behind.
		for (const linked of this.group.linkedResizersFor(this)) linked.group.distributeEvenly();
		this.group.distributeEvenly();
	};

	#onmouseup: MouseEventHandler<HTMLElement> = () => {
		this.#stopDraggingAndBlur();
	};

	#ontouchcancel: TouchEventHandler<HTMLElement> = () => {
		this.#stopDraggingAndBlur();
	};

	#ontouchend: TouchEventHandler<HTMLElement> = () => {
		this.#stopDraggingAndBlur();
	};

	#ontouchstart: TouchEventHandler<HTMLElement> = (e: TouchEvent) => {
		this.#startDragging(e);
	};

	readonly props = $derived.by(
		() =>
			({
				id: this.opts.id.current,
				role: "separator",
				"data-direction": this.group.opts.direction.current,
				"data-pane-group-id": this.group.opts.id.current,
				"data-active": this.#isDragging
					? "pointer"
					: this.#isFocused
						? "keyboard"
						: undefined,
				"data-enabled": !this.opts.disabled.current,
				"data-pane-resizer-id": this.opts.id.current,
				"data-pane-resizer": "",
				tabIndex: this.opts.tabIndex.current,
				style: {
					cursor: getCursorStyle(this.group.opts.direction.current),
					// Junctions are positioned against this element, so it becomes a
					// containing block only once it actually hosts one.
					...(this.hostedJunctions.length > 0 ? { position: "relative" } : {}),
					touchAction: "none",
					userSelect: "none",
					"-webkit-user-select": "none",
					"-webkit-touch-callout": "none",
				},
				onkeydown: this.#onkeydown,
				ondblclick: this.#ondblclick,
				onblur: this.#onblur,
				onfocus: this.#onfocus,
				onmousedown: this.#onmousedown,
				onmouseup: this.#onmouseup,
				ontouchcancel: this.#ontouchcancel,
				ontouchend: this.#ontouchend,
				ontouchstart: this.#ontouchstart,
				...this.attachment,
			}) as const
	);
}

interface PaneStateOpts
	extends WithRefProps,
		ReadableBoxedValues<{
			collapsedSize: number | undefined;
			collapsible: boolean | undefined;
			defaultSize: PaneSize | undefined;
			maxSize: PaneSize | undefined;
			minSize: PaneSize | undefined;
			order: number | undefined;
			units: PaneUnits | undefined;
			onCollapse: PaneOnCollapse;
			onExpand: PaneOnExpand;
			onResize: PaneOnResize;
		}> {}

export class PaneState {
	static create(opts: PaneStateOpts) {
		return new PaneState(opts, PaneGroupContext.get());
	}

	readonly opts: PaneStateOpts;
	readonly group: PaneGroupState;
	readonly attachment: RefAttachment;
	readonly domContext: DOMContext;

	#paneTransitionState: PaneTransitionState = $state("");
	readonly callbacks = $derived.by(() => ({
		onCollapse: this.opts.onCollapse.current,
		onExpand: this.opts.onExpand.current,
		onResize: this.opts.onResize.current,
	}));

	/**
	 * The unit this pane is sized in, which is the unit every size on it is read in. Its own
	 * where it has one, and otherwise whatever its group sizes in.
	 */
	readonly units: PaneUnits = $derived.by(
		() => this.opts.units.current ?? this.group.opts.units.current
	);

	/** What this pane says about its own size, each in whichever unit it was written in. */
	readonly constraints: PaneSizeConstraints = $derived.by(() => ({
		collapsedSize: this.opts.collapsedSize.current,
		collapsible: this.opts.collapsible.current,
		defaultSize: resolvePaneSize(this.opts.defaultSize.current, this.units),
		maxSize: resolvePaneSize(this.opts.maxSize.current, this.units),
		minSize: resolvePaneSize(this.opts.minSize.current, this.units),
	}));

	#handleTransition = (state: PaneTransitionState) => {
		this.#paneTransitionState = state;
		afterTick(() => {
			if (this.opts.ref.current) {
				const element = this.opts.ref.current;
				const computedStyle = getComputedStyle(element);

				const hasTransition = computedStyle.transitionDuration !== "0s";

				if (!hasTransition) {
					this.#paneTransitionState = "";
					return;
				}
				const handleTransitionEnd = (event: TransitionEvent) => {
					// Only handle width/flex transitions
					if (event.propertyName === "flex-grow") {
						this.#paneTransitionState = "";
						element.removeEventListener("transitionend", handleTransitionEnd);
					}
				};

				// Always add the listener - if there's no transition, it won't fire
				element.addEventListener("transitionend", handleTransitionEnd);
			} else {
				this.#paneTransitionState = "";
			}
		});
	};

	readonly pane = {
		collapse: () => {
			this.#handleTransition("collapsing");
			this.group.collapsePane(this);
		},
		expand: () => {
			this.#handleTransition("expanding");
			this.group.expandPane(this);
		},
		getSize: () => this.group.getPaneSize(this),
		isCollapsed: () => this.group.isPaneCollapsed(this),
		isExpanded: () => this.group.isPaneExpanded(this),
		resize: (size: number) => this.group.resizePane(this, size),
		getId: () => this.opts.id.current,
	};

	constructor(opts: PaneStateOpts, group: PaneGroupState) {
		this.opts = opts;
		this.group = group;
		this.attachment = attachRef(this.opts.ref);
		this.domContext = new DOMContext(this.opts.ref);

		onMount(() => {
			return this.group.registerPane(this);
		});

		watch([() => $state.snapshot(this.constraints), () => this.units], () => {
			this.group.panesArrayChanged = true;
		});
	}

	readonly #isCollapsed = $derived.by(() => this.group.isPaneCollapsed(this));
	readonly #paneState = $derived.by(() =>
		this.#paneTransitionState !== ""
			? this.#paneTransitionState
			: this.#isCollapsed
				? "collapsed"
				: "expanded"
	);

	readonly props = $derived.by(
		() =>
			({
				id: this.opts.id.current,
				style: this.group.getPaneStyle(this),
				"data-pane": "",
				"data-units": this.units,
				"data-pane-id": this.opts.id.current,
				"data-pane-group-id": this.group.opts.id.current,
				"data-collapsed": this.#isCollapsed ? "" : undefined,
				"data-expanded": this.#isCollapsed ? undefined : "",
				"data-pane-state": this.#paneState,
				...this.attachment,
			}) as const
	);
}
interface PaneJunctionsStateOpts
	extends ReadableBoxedValues<{
		disabled: boolean;
		tolerance: number;
		crossTolerance: number;
		onDraggingChange: PaneJunctionOnDragging;
		child: PaneJunctionChild | undefined;
		children: PaneJunctionChildren | undefined;
		restProps: Record<string, unknown>;
	}> {}

/**
 * A junction is a point where resizers travelling along opposing axes meet, letting both be
 * dragged at once.
 *
 * Junctions are found geometrically across the entire subtree of the group they are scoped
 * to, which is what makes them independent of nesting depth: two resizers form a junction
 * when they touch on screen, however far apart they sit in the component tree.
 *
 * Nothing is rendered here. Each junction is handed to the group that hosts it, which
 * renders it among its own children.
 */
export class PaneJunctionsState {
	static create(opts: PaneJunctionsStateOpts) {
		return new PaneJunctionsState(opts, PaneGroupContext.get());
	}

	readonly opts: PaneJunctionsStateOpts;
	readonly group: PaneGroupState;
	readonly domContext: DOMContext;

	/**
	 * Ids of the resizers this layer put into a drag, so it can take them back out of one.
	 *
	 * Ids rather than the resizers themselves: a resizer can be replaced while the drag is
	 * running, and holding on to the old one would report the end of the drag to something
	 * that is no longer on the page while the one that is stays stuck.
	 */
	#activeResizerIds: string[] = [];
	/**
	 * The resizers the active drag is moving, grouped by the axis they travel along.
	 *
	 * The resizers on one axis all sit at the same point along it, so they are moved as one
	 * set and go as far as all of them can. The two axes are independent of each other, and
	 * are negotiated separately.
	 */
	#activeAxes: PaneResizerState[][] = [];
	#junctions = $state.raw<ComputedJunction[]>([]);
	/** The resizer that renders each junction, keyed by junction id. */
	#hosts = $state.raw<Map<string, PaneResizerState>>(new Map());
	#activeId = $state.raw<string | null>(null);

	readonly #resizerElements = $derived.by(() =>
		this.group.groupsInScope.flatMap((group) =>
			group.resizersArray
				.map((resizer) => resizer.opts.ref.current)
				.filter((element): element is HTMLElement => element !== null)
		)
	);

	constructor(opts: PaneJunctionsStateOpts, group: PaneGroupState) {
		this.opts = opts;
		this.group = group;
		this.domContext = group.domContext;

		onMount(() => group.registerJunctionLayer(this));

		// Layout changes are tracked reactively, but the group can also be resized from the
		// outside, and panes may animate to their new size.
		useResizeObserver(
			() => {
				const scope = this.group.opts.ref.current;
				return scope ? [scope, ...this.#resizerElements] : this.#resizerElements;
			},
			() => this.#remeasure()
		);

		$effect(() => {
			this.#remeasure();
		});

		$effect(() => {
			if (this.#activeId === null) return;

			const domBody = this.domContext.getDocument().body;
			const domWindow = this.domContext.getWindow();

			return executeCallbacks(
				on(domBody, "contextmenu", this.#stopDragging),
				on(domBody, "mousemove", this.#resize),
				on(domBody, "touchmove", this.#resize, { passive: false }),
				on(domBody, "mouseleave", this.#resize),
				on(domWindow, "mouseup", this.#stopDragging),
				on(domWindow, "touchend", this.#stopDragging),
				on(domWindow, "touchcancel", this.#stopDragging)
			);
		});
	}

	#remeasure = () => {
		const { junctions, hosts } = this.#measure();
		this.#junctions = junctions;
		this.#hosts = hosts;
	};

	#measure = (): { junctions: ComputedJunction[]; hosts: Map<string, PaneResizerState> } => {
		const tolerance = this.opts.tolerance.current;
		const crossTolerance = this.opts.crossTolerance.current;
		// Read reactively before bailing out, so a later measure is never skipped.
		const groups = this.group.groupsInScope;

		if (!this.group.opts.ref.current) {
			return { junctions: [], hosts: new Map() };
		}

		const candidates: JunctionCandidate[] = [];
		const resizersById = new Map<string, PaneResizerState>();

		for (const group of groups) {
			// Touching the layout keeps junctions in sync with every group in scope, no
			// matter how deeply it is nested. A group without one has nothing to contribute.
			if (group.layout.length === 0) continue;

			const axis = directionToJunctionAxis(group.opts.direction.current);
			const groupId = group.opts.id.current;

			for (const resizer of group.resizersArray) {
				if (resizer.opts.disabled.current) continue;

				const element = resizer.opts.ref.current;
				if (!element) continue;

				const rect = element.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) continue;

				resizersById.set(resizer.opts.id.current, resizer);

				// Measured in viewport space. Only used to work out which junctions exist
				// and which resizer each one is anchored to; their placement comes from the
				// anchor's own box.
				candidates.push({
					id: resizer.opts.id.current,
					groupId,
					axis,
					rect: {
						top: rect.top,
						right: rect.right,
						bottom: rect.bottom,
						left: rect.left,
					},
				});
			}
		}

		const hosts = new Map<string, PaneResizerState>();
		const junctions = computeJunctions(candidates, { tolerance, crossTolerance }).filter(
			(junction) => {
				const anchor = resizersById.get(junction.anchor.resizerId);
				if (!anchor) return false;
				hosts.set(junction.id, anchor);
				return true;
			}
		);

		return { junctions, hosts };
	};

	/** The resizers a junction drives, resolved from the ids its geometry produced. */
	#resizersFor = (junction: ComputedJunction): PaneResizerState[] => {
		const ids = new Set([...junction.xResizerIds, ...junction.yResizerIds]);
		const resizers: PaneResizerState[] = [];

		for (const group of this.group.groupsInScope) {
			for (const resizer of group.resizersArray) {
				if (!ids.has(resizer.opts.id.current)) continue;
				if (resizer.opts.disabled.current) continue;
				resizers.push(resizer);
			}
		}

		return resizers;
	};

	/**
	 * The resizers a junction drives, split into the two axes.
	 *
	 * Resizers travelling along the same axis meet the junction at the same point along it, so
	 * they have to move as one set. Resizers on opposing axes have nothing to say to each other
	 * and are moved separately.
	 */
	#axesFor = (junction: ComputedJunction): PaneResizerState[][] => {
		const resizers = this.#resizersFor(junction);
		const along = (ids: string[]) =>
			resizers.filter((resizer) => ids.includes(resizer.opts.id.current));

		return [along(junction.xResizerIds), along(junction.yResizerIds)].filter(
			(axis) => axis.length > 0
		);
	};

	/**
	 * Moves everything the junction drives, one axis at a time.
	 *
	 * Each group works out its own change from the same pointer event, taking the axis it
	 * resizes along, and the resizers on an axis go only as far as all of them can — so the
	 * line they form stays a line however tight one of them gets.
	 */
	#resize = (e: ResizeEvent) => {
		if (this.#activeId === null) return;
		for (const axis of this.#activeAxes) resizeTogether(axis, e);
	};

	#startDragging = (junction: ComputedJunction, e: MouseEvent | TouchEvent) => {
		if (this.opts.disabled.current) return;

		const resizers = this.#resizersFor(junction);
		if (resizers.length === 0) return;

		e.preventDefault();
		// The junction is rendered inside one of the resizers it drives, so the event would
		// otherwise reach that resizer and start a second, single-axis drag. A disabled
		// junction deliberately does not stop it, leaving the resizer to handle the drag.
		e.stopPropagation();

		// The junction drives all of them from here on: each resizer stands down so that the
		// resizers on an axis are moved as one set rather than each following the pointer as
		// far as its own panes happen to allow.
		this.#activeResizerIds = resizers.map((resizer) => resizer.opts.id.current);
		this.#activeAxes = this.#axesFor(junction);

		for (const resizer of resizers) {
			resizer.group.startDragging(resizer.opts.id.current, e, junction.id);
			resizer.setDragging(true);
			resizer.setDriven(true);
		}

		this.#activeId = junction.id;
		setGlobalCursorStyle("junction", this.domContext.getDocument());
		this.opts.onDraggingChange.current(true, junction.id);
	};

	/**
	 * The groups a junction can move, which is every group whose divider it drags, plus the
	 * groups of any dividers linked to those.
	 */
	#groupsFor = (junction: ComputedJunction): Set<PaneGroupState> => {
		const groups = new Set<PaneGroupState>();

		for (const resizer of this.#resizersFor(junction)) {
			groups.add(resizer.group);
			for (const linked of resizer.group.linkedResizersFor(resizer)) groups.add(linked.group);
		}

		return groups;
	};

	/**
	 * Evens out every group the junction can move, so double clicking one does to all of its
	 * axes what double clicking a resizer does to one.
	 *
	 * Groups that have not asked for this are left alone, as they are for a resizer.
	 */
	#evenOut = (junction: ComputedJunction, e: MouseEvent) => {
		if (this.opts.disabled.current || e.defaultPrevented) return;

		const groups = [...this.#groupsFor(junction)].filter(
			(group) => group.opts.evenOnDoubleClick.current
		);
		if (groups.length === 0) return;

		e.preventDefault();
		// The junction is rendered inside one of the resizers it drives, which would otherwise
		// even out its own group a second time.
		e.stopPropagation();

		for (const group of groups) group.distributeEvenly();
	};

	#stopDraggingFromEvent = (e: MouseEvent | TouchEvent) => {
		if (this.#activeId !== null) e.stopPropagation();
		this.#stopDragging();
	};

	#stopDragging = () => {
		const activeId = this.#activeId;
		if (activeId === null) return;

		this.#activeId = null;

		// This layer started the drag on each of these, so it finishes it too rather than
		// leaving the closing half to them: a resizer whose own listeners never got the chance
		// to attach would otherwise stay in its dragging state for good.
		const activeIds = new Set(this.#activeResizerIds);
		this.#activeResizerIds = [];
		this.#activeAxes = [];

		for (const group of this.group.groupsInScope) {
			for (const resizer of group.resizersArray) {
				if (!activeIds.has(resizer.opts.id.current)) continue;
				group.stopDragging();
				resizer.setDragging(false);
			}
		}

		// Catches any group whose resizer went away mid-drag, which would otherwise stay stuck.
		for (const group of this.group.groupsInScope) {
			if (group.dragState?.junctionId === activeId) group.stopDragging();
		}

		resetGlobalCursorStyle();
		this.opts.onDraggingChange.current(false, activeId);
	};

	#toHosted = (junction: ComputedJunction, host: PaneResizerState): HostedJunction => {
		const disabled = this.opts.disabled.current;
		const isDragging = this.#activeId === junction.id;
		const type =
			junction.xResizerIds.length + junction.yResizerIds.length > 2 ? "cross" : "tee";
		const { axis, offset, side } = junction.anchor;

		// The anchor runs through the junction, so it settles one axis on its own: the
		// junction spans its full thickness there. Along the anchor's length it sits at the
		// measured offset, which is the only number that has to come from a measurement.
		const placement =
			axis === "x"
				? {
						left: 0,
						width: "100%",
						top: `${offset}px`,
						height: `${junction.height}px`,
						transform: "translateY(-50%)",
					}
				: {
						top: 0,
						height: "100%",
						left: `${offset}px`,
						width: `${junction.width}px`,
						transform: "translateX(-50%)",
					};

		const data: PaneJunctionData = {
			id: junction.id,
			x: junction.x,
			y: junction.y,
			width: junction.width,
			height: junction.height,
			type,
			index: junction.index,
			isDragging,
			anchor: junction.anchor,
			resizerIds: { x: junction.xResizerIds, y: junction.yResizerIds },
		};

		const props = {
			"data-pane-junction": "",
			"data-pane-junction-id": junction.id,
			"data-pane-group-id": host.group.opts.id.current,
			"data-junction-type": type,
			// Together these give the junction's orientation: which way the resizer it
			// sits on runs, and which side the others arrive from, so a tee can be styled
			// to point the right way. A cross is met from both sides and has no one side.
			"data-junction-axis": axis,
			"data-junction-side": side,
			"data-active": isDragging ? "pointer" : undefined,
			"data-enabled": !disabled,
			// Every resizer a junction drives is already exposed on its own as an accessible
			// `separator`, so the junction stays out of the tab order rather than duplicating
			// them. It is a pointer shortcut, not a second way to reach the same controls.
			"aria-hidden": "true",
			style: {
				position: "absolute",
				// Resizers are commonly given `position: relative`, which makes a later one
				// paint over a junction rendered inside an earlier one. A junction has to
				// stay clickable, so it is lifted above them.
				zIndex: 1,
				...placement,
				"--pane-junction-width": `${junction.width}px`,
				"--pane-junction-height": `${junction.height}px`,
				// Omitted rather than written as `undefined`, which would be invalid CSS.
				...(disabled ? {} : { cursor: getCursorStyle("junction") }),
				touchAction: "none",
				userSelect: "none",
				"-webkit-user-select": "none",
				"-webkit-touch-callout": "none",
			},
			onmousedown: (e: MouseEvent) => this.#startDragging(junction, e),
			ondblclick: (e: MouseEvent) => this.#evenOut(junction, e),
			ontouchstart: (e: TouchEvent) => this.#startDragging(junction, e),
			onmouseup: this.#stopDraggingFromEvent,
			ontouchend: this.#stopDraggingFromEvent,
			ontouchcancel: this.#stopDraggingFromEvent,
		};

		return {
			junction: data,
			props: mergeProps(this.opts.restProps.current, props),
			child: this.opts.child.current,
			children: this.opts.children.current,
		};
	};

	/** The junctions a given resizer is responsible for rendering. */
	junctionsFor = (resizer: PaneResizerState): HostedJunction[] => {
		const hosts = this.#hosts;

		return this.#junctions
			.filter((junction) => hosts.get(junction.id) === resizer)
			.map((junction) => this.#toHosted(junction, resizer));
	};

	readonly api = {
		getJunctions: (): PaneJunctionData[] => {
			const hosts = this.#hosts;

			return this.#junctions.flatMap((junction) => {
				const host = hosts.get(junction.id);
				return host ? [this.#toHosted(junction, host).junction] : [];
			});
		},
	};
}
