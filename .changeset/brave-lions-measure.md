---
"paneforge": minor
---

feat: add `units` to `Pane`, so a single pane can be sized in pixels while the panes beside it go on taking a share of the group. Give a sidebar `units="pixels"` and a `defaultSize` in pixels and it holds that width as the window resizes, with the pane next to it absorbing the difference — no size of its own needed.

Every size on a pane is read in its own unit: `defaultSize`, `minSize`, `maxSize`, `collapsedSize`, and the sizes reported by `onResize`, `getSize` and `onLayoutChange`. A percentage is a share of the whole group, pixel panes included, so a `minSize` in percent is a limit an absolute pane will actually run into as it grows.

The two units are the two ways flexbox sizes a child, which is what lets them share a group: an absolute size becomes a `flex-basis`, taken out of the group first, and a share becomes a `flex-grow` weight over what is left. When the group changes size the difference is offered to the panes taking a share, split between them in proportion so their shares of one another are untouched; only what they cannot take comes out of the absolute ones, working backwards from the last.

feat: add `units` to `PaneGroup`, which sets the unit for the panes inside it that do not say for themselves. `getTotalSize()` reports what the panes share out: 100 while every pane takes a share, and the pixels left over after the resizers once any pane is sized in pixels.
