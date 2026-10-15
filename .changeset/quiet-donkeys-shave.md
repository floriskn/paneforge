---
"paneforge": minor
---

feat: add `PaneJunctions`, which renders a handle wherever perpendicular resizers meet so nested groups can be resized along both axes at once. Junctions are found geometrically across the whole subtree of the group they are placed in, so they work at any nesting depth, and each one is rendered by the group whose own resizer it sits on.

Each junction is rendered inside the resizer it sits at the end of, and positioned against that resizer's box with no measured coordinates, so it stays put while panes animate. `PaneResizer`'s `child` snippet now also receives a `junctions` snippet, which should be rendered inside the element it returns.
