# Text editing

- Text nodes - nodes of type bullet, paragraph, or heading.
- Editor: [CodeMirror 6](https://codemirror.net/).
  - Live preview of markdown via CodeMirror decorations.
  - One CodeMirror editor per node.
    - Only the visible nodes have an editor (virtual list).
    - Editors are pooled and reused when scrolling, via `view.setState(...)`. The extension list is created once and shared.
      - The pool keeps at most 50 free editors.
    - The node with the cursor stays rendered when it is scrolled out of the view, so it keeps the focus and the cursor. #todo implemented in #9.
    - Possible later, if scrolling is not smooth: render static HTML during fast scroll, create editors when the scroll stops.
  - Cursor movement and selection across nodes are handled by DiaMind, not by CodeMirror.
- Vim key bindings are postponed. Not part of the first version.
- Unlike Workflowy, the text editing should resemble Obsidian - formatting is done via WISIWYG markdown. For example, when a cursor is in the bold text (text surrounded by `**` ), the star literals should be visible, otherwise, only a bold text should be visible.
- Note that in workflowy, when you select text, the formatting popup bar is displayed next to the text - I don't want that.
- Links
  - `file://` links are opened via system's `open` . So that I can, e.g., click on `file:///Users/pavel` and that will open finder in my home directory.
  - `http://` and `https://` links are opened via system's browser.
