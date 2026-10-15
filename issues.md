## Phase 1: Bug Fix & SSR Optimization (Junction DOM Positioning)

```markdown
### Prompt 1: Fix Junction SSR Hydration and DOM Optimization

**Objective:**
Fix Server-Side Rendering (SSR) bugs with Junction elements by optimizing their DOM placement and positioning logic.

**Current Problem:**
Junctions are currently appended dynamically into the root DOM tree and rely on absolute calculations (`left`, `top`) to align with pane corners. This causes layout shifts, hydration mismatches during SSR, and unnecessary layout repaints.

**Requirements & Logic:**

1. **DOM Structure Optimization:**
    - Instead of injecting Junctions as absolute floating elements in the root tree, anchor them directly inside the relative corner of their target Parent Pane / Pane Group.
    - Leverage the existing pane flex layout (`flex: 1 1 0%`) to keep Junctions aligned within the layout tree natively.
2. **Corner Resolution:**
    - Implement deterministic corner detection (e.g., `top-left`, `top-right`, `bottom-left`, `bottom-right`) based on the Pane's position within its parent group.
    - Position the Junction within that specific corner relative to the parent pane bounds.
3. **SSR Safety:**
    - Ensure initial rendering generates valid, deterministic HTML/CSS during SSR without requiring client-side window/bounding rect measurements before initial render.

**Expected Deliverables:**

- Refactored Junction rendering logic.
- Clean DOM tree hierarchy where Junctions reside in their host Pane boundaries.
- Verified SSR compatibility (no layout jump or hydration errors on initial page load).
```

---

## Phase 2: Feature Addition (Pixel-Based Sizing & Min/Max Constraints)

```markdown
### Prompt 2: Add Pixel Sizing & Pixel Min/Max Constraints

**Objective:**
Extend the Pane sizing engine to support fixed/explicit pixel (`px`) sizing in addition to relative percentage (`flex: <grow> <shrink> 0%`) sizing, and support pixel-based min/max boundaries.

**Requirements & Logic:**

1. **Pixel Sizing Support:**
    - Allow Panes to accept size definitions in pixels (e.g., `size={300}` or `size="300px"`).
    - Convert these definitions into corresponding flex flexbox attributes (e.g., `flex: 0 0 300px` or fixed CSS dimensions) while preserving flex behavior for adjacent percentage-based panes.
2. **Pixel Min/Max Constraints:**
    - Add props/options for `minSize` and `maxSize` specified in pixels (`px`) alongside existing percentage constraints.
    - Update the resize handle calculation engine to enforce these pixel limits dynamically during user drag interactions.
3. **Hybrid Calculations:**
    - Ensure pane resizing recalculates neighbor flex allocations correctly when mixed mode (pixel-fixed panes alongside percentage flex panes) is active in the same Pane Group.

**Expected Deliverables:**

- Updated Pane props/interface to accept pixel values for size, `minSize`, and `maxSize`.
- Updated drag/resize math engine handling pixel boundary checks.
```

---

## Phase 3: Complex Feature (Edge Merging for 2x2 Sub-Grids)

```markdown
### Prompt 3: Implement Synchronized Edge Merging for Sub-Grids

**Objective:**
Add an optional `mergeEdges` feature to `PaneGroup` that synchronizes aligned divider edges in 2x2 sub-grids without altering the DOM hierarchy.

**Visual Context & Requirements:**

1. **Edge Alignment Check:**
    - When a `PaneGroup` (horizontal or vertical) has `mergeEdges={true}` enabled:
        - Upon creation/mount of adjacent panes (e.g., a 2x2 layout), check if split lines/edges are horizontally or vertically aligned at the same offset.
        - If aligned, virtually merge these split lines into a synchronized drag handle.
```

Example 2x2 Merged Layout:
+-----------+-----------+
| Pane A | Pane B |
+-----------+-----------+ <--- Merged Horizontal Edge
| Pane C | Pane D |
+-----------+-----------+
^
Merged Vertical Edge

```

2. **Virtual / Code-Only Merge:**
   - **Do NOT re-structure the DOM tree.** Keep the existing group hierarchy.
   - Implement the merge purely in state/event management: dragging one merged edge should trigger simultaneous position updates for all synchronized edges.

3. **Sub-Grid Isolation & Auto-Break Rules:**
   - Edge merging applies strictly to the specific `PaneGroup` configured with `mergeEdges={true}`. Root or ancestor groups without this option set MUST NOT merge edges.
   - **Deep Nesting Breakdown:** If a new child/nested Pane or Sub-Group is dynamically added inside one of the merged 2x2 panes, **automatically break/disband the edge merge** for that set, returning edges to independent resizers.

```

Isolated Sub-Grid Example:
+-----------------------+
| Root Group (No Merge) |
+-----------+-----------+
| Pane 1 | Pane 2 |
|-----------|-----------+ <--- Merged 2x2 Sub-Grid Group
| Pane 3 | Pane 4 |
+-----------+-----------+

```

**Expected Deliverables:**
- `mergeEdges` prop added to `PaneGroup`.
- Logical synchronization layer in the drag engine to sync resizer positions.
- Edge detachment logic when deep nested panes are inserted.
```

---

## Phase 4: ARIA & Accessibility Compliance Audit

```markdown
### Prompt 4: Accessibility & ARIA Compliance Verification

**Objective:**
Audit and update all newly added layout logic, resizers, pane handles, and junction controls to meet WCAG / ARIA compliance standards.

**Requirements & Checklist:**

1. **ARIA Roles & Attributes:**
    - Ensure resizers / divider handles have `role="separator"`.
    - Set `aria-orientation` ("horizontal" | "vertical") on all split handles.
    - For resizers, provide `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` (representing current pixel or percentage allocation).
    - Ensure resizers reference their controlled panes using `aria-controls`.
2. **Keyboard Navigation:**
    - Ensure all resizer handles are focusable (`tabIndex={0}`).
    - Support standard arrow key interactions:
        - `ArrowLeft` / `ArrowUp`: Decrease pane size.
        - `ArrowRight` / `ArrowDown`: Increase pane size.
        - `Home` / `End`: Jump to min/max sizes.
3. **Screen Reader Feedback:**
    - Add descriptive `aria-label` or `aria-roledescription` to handles (e.g., "Resize pane section").
    - Ensure merged edges (from Phase 3) report coherent value changes to assistive technology.

**Expected Deliverables:**

- Full ARIA attribute integration across Pane, Resizer, and Junction components.
- Keyboard navigation handler implementation for all interactive splitters.
```
