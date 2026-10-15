---
"paneforge": patch
---

fix: a pane lands on the exact size it was given in pixels, rather than a fraction out. Three things were rounding it off: the group's size was read from `clientWidth`, which is rounded to whole pixels, and half a pixel of a group spread over its panes is enough to leave a pane told 48px measuring 48.02px; grow weights were written to three significant figures, which is a fiftieth of a pixel on its own; and a limit in pixels only ever reached the layout, never flexbox.

A group now takes its size from what the resize observer reports, which is the real fractional content box, and reads its resizers from their boxes rather than their rounded offset sizes. Grow weights are written to four decimal places. And a `minSize` or `maxSize` written in pixels is handed to flexbox as a `min-width`/`max-width` (or `min-height`/`max-height`) along the axis the pane is sized on, so the browser holds the pane there exactly. Collapsible panes get no floor, since they have to be able to reach their collapsed size.
