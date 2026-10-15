---
"paneforge": minor
---

feat: add `evenOnDoubleClick` to `PaneGroup`, which gives every pane in the group the same size when a resize handle is double clicked. Off by default, and available as `distributeEvenly()` on the group so it can go behind your own control instead. Works in whichever unit the group is measured in.

feat: add `align` to `PaneGroup`, which drags dividers in the groups nested inside it together when they line up. In a 2x2 layout the two row dividers start out on the same line, so dragging either moves both and they stay aligned; drag one out of line and they go back to being independent.

Those groups keep their own sizes throughout — nothing is shared. Whether two dividers travel together is worked out from where they actually are when a drag starts, so a pair that comes apart, because one of them ran out of room, simply stops being linked. Double clicking a linked divider evens out both of their groups.
