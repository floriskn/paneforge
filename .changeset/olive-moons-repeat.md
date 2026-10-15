---
"paneforge": patch
---

fix: stop panes emitting `pointer-events: undefined` in their style attribute when not being dragged. Browsers dropped the invalid declaration, but it was shipped in server-rendered markup for every pane.
