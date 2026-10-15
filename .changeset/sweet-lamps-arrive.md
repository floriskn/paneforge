---
"paneforge": minor
---

feat: resizers that are dragged together now move as one line. Everything a junction drives along one axis, and every divider linked by `align`, is offered each move and they all move by the smallest share any of them could manage — so where one reaches a pane's `minSize` is where all of them stop, instead of the ones with room running on and leaving the line broken in two. The two axes of a junction stay independent of each other: one running out of room does not hold the other back.

feat: double clicking a `PaneJunctions` junction acts on every group it can move, so a crossing evens out — or resets — along both axes at once rather than one resizer's group at a time. It follows the same `doubleClick` setting as a resizer does, per group: each group has its own say in whether that means evening out or resetting, and groups that asked for nothing are left alone. When none of them asked for anything, the double click passes through untouched.

feat: `PaneResizer`'s `child` snippet also receives `getLinkedIds()`, the ids of the resizers that would be dragged along with this one because they line up with it. Dividers are linked by where they currently are, so it is measured when called — which is what makes it possible to light two linked dividers as one without hard coding which they are.
