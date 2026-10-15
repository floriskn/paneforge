---
"paneforge": minor
---

feat: a size on a `Pane` can name its own unit, as `minSize="180px"` or `maxSize="60%"`, whatever the pane itself is sized in. A bare number is still read in the pane's `units`.

This matters most for `minSize`. A limit given as a share of the group is a different number of pixels at every group size, so the same pane has a different smallest size at every nesting depth; in pixels it is the same limit wherever the pane sits, which is how VS Code behaves. A pane that takes a share of the group can now refuse to go below the width its contents need while still following the group as it resizes. If the group shrinks so far that a pixel minimum no longer fits, the layout is pulled back to respect it.

`defaultSize` and `maxSize` read the same way. Groups with nothing written in pixels are never measured, so they behave exactly as they always have.
