# Text editing

- Text nodes - nodes of type bullet, paragraph, or heading.
- Editor: [CodeMirror 6](https://codemirror.net/).
  - Live preview of markdown via CodeMirror decorations.
  - #todo one editor per node vs. one editor for the whole view.
- Vim key bindings are postponed. Not part of the first version.
- Unlike Workflowy, the text editing should resemble Obsidian - formatting is done via WISIWYG markdown. For example, when a cursor is in the bold text (text surrounded by `**` ), the star literals should be visible, otherwise, only a bold text should be visible.
- Note that in workflowy, when you select text, the formatting popup bar is displayed next to the text - I don't want that.
- Links
  - `file://`  links are opened via system's `open` . So that I can, e.g., click on `file:///Users/pavel`  and that will open finder in my home directory.
  - `http://`  and `https://`  links are opened via system's browser.
