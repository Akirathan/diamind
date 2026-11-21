# Notes

- Inspired by Workflowy.
- Every node can have a *note* - a multi-line text displayed below the node text.
  - Attachment nodes can also have a note (e.g. as a caption).
- Display
  - Smaller and grey font, aligned with the node text.
  - The whole note is visible. #todo truncate long notes?
  - Same markdown live preview as the node text, see [Text editing](text-editing.md).
- Editing
  - `Shift + Enter` in the node text moves the cursor to the end of the note. Creates the note if it does not exist.
  - `Shift + Enter` in the note moves the cursor back to the end of the node text.
  - `Enter` in the note inserts a new line.
  - `Up` / `Down` move between the node text and the note as if they were consecutive lines.
  - The note has its own CodeMirror editor. It exists only if the note is not empty or is focused.
- A note that becomes empty is removed when it loses focus.
- A node is *empty* only if both its text and its note are empty. See the empty sibling rules in [Data model](data-model.md).
- `Backspace` merge: the note of the merged node is appended to the note of the upper node, separated by a new line.
- Search, Jump to and Filter also match the text of notes.
- Import: the `_note` attribute of a Workflowy OPML outline becomes the note.
