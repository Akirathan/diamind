# Import

## Import from Workflowy

- _File > Import from Workflowy..._ in the application menu. Imports an OPML file exported from Workflowy.
- The imported nodes are added after the last child of the local root, in the same order and with the same tree structure.
- The whole import is one undo step.
- The Workflowy formatting is converted to markdown where possible, see [Text editing](text-editing.md).
- The `_note` attribute becomes the note, see [Notes](notes.md).
- `_complete="true"` marks the node as completed, see [Completed nodes](completed.md).
