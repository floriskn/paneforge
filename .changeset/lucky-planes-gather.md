---
"paneforge": minor
---

feat: add `doubleClick` to `PaneGroup`, which says what double clicking a resize handle does to the group's sizes: `"even"` gives every pane the same size, and `"reset"` puts them back to the sizes they started at — each pane's `defaultSize`, with whatever is left over shared between the panes that were given none. It does nothing until you pick one.

Both are available on the group as `distributeEvenly()` and `resetToDefaults()`, so either can go behind your own control instead. Either reads the same in whichever unit each pane is written in.

feat: add `align` to `PaneGroup`, which drags dividers in the groups nested inside it together when they line up. In a 2x2 layout the two row dividers start out on the same line, so dragging either moves both and they stay aligned; drag one out of line and they go back to being independent.

Those groups keep their own sizes throughout — nothing is shared. Whether two dividers travel together is worked out from where they actually are when a drag starts, so a pair that comes apart, because one of them ran out of room, simply stops being linked. Double clicking a linked divider evens out both of their groups.
