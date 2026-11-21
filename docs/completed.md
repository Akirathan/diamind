# Completed nodes

- Inspired by Workflowy.
- Any node can be marked as *completed*.
- `Cmd + Enter` toggles the completed state of the current node, or of all nodes in a multi-node selection.
  - Also available in the three dots context menu: *Complete* / *Uncomplete*.
- Display
  - The text of a completed node is struck through and grey.
  - The children of a completed node are displayed grey too, but are not marked as completed themselves.
- Show / hide completed
  - A global toggle, stored per device in `app_state`. Visible by default.
  - Available in the command palette. #todo default keyboard shortcut.
  - When hidden, completed nodes and their children are not displayed and not matched by Search, Jump to and Filter.
- A new node created by `Enter` in a completed node is not completed.
- Stored as `completed_at` (timestamp, empty if not completed), see [Storage](storage.md).
- Import: `_complete="true"` in a Workflowy OPML outline marks the node as completed, with the import time as `completed_at`.
