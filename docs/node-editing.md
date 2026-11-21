# Node editing

- When hovering over a node (on a line), bullet point and three dots should be displayed to the left of the node. 
- Bullet point enables drag-and-drop of the node
- Three dots gives a context menu for the node:
  - Turn Into -> Bullets, Paragraph, Code block, Heading 1, Heading 2, Heading 3, Divider
- Hiting `Tab` on any position in the node *indents* it.
- Hitting `Shift + Tab`  on any position in the node *unindents* it.
- Hitting `Enter` in an empty node:
  - If the node is the last child, it is *unindented*.
    - If the node is a child of the global root or of the local root, nothing happens.
    - If the unindent would make the last two children of the new parent empty, nothing happens. #todo revisit this corner case.
  - If the node is not the last child, a new empty sibling is created below it.
  - Follows the rule about empty siblings in [Data model](data-model.md).
- Hitting `Backspace` at the beginning of a node merges it into the previous visible node (the *upper node*).
  - The upper node keeps its id, `created_at` and format.
  - The text of the merged node is appended to the text of the upper node.
  - The children of the merged node are appended to the children of the upper node.
- `Up` / `Down` on the first / last line of a node moves the cursor to the previous / next visible node.
  - The cursor goes to the beginning of that node. The horizontal position is not kept.
- Attachment nodes have no text cursor. When the cursor moves to an attachment node (`Up` / `Down`), the node is *selected* (highlighted).
  - `Up` / `Down` moves to the previous / next visible node.
  - `Backspace` or `Delete` deletes the attachment node.
  - `Enter` creates a new empty bullet node below it.

## Multi-node selection

- When a text selection extends over the boundary of a node, it becomes a selection of whole nodes.
- These work on a multi-node selection:
  - `Tab` and `Shift + Tab` - indent / unindent all selected nodes.
  - `Delete` - deletes all selected nodes.
  - Copy and paste.

## Indent lines

- Indent lines are always visible, just like in Workflowy
- A node with some children has an arrow displayed to the left of the bullet point with which you can expand or collapse the children
- Hovering over the end of the indent line reveals a plus icon.
  - Clicking on the plus icon will add a node to the end of the indent line.
  - A newly created node is always of a bullet format.
- The *current indent line* is highlighted.
  - The current indent line is the one that belongs to the parent node of the current node.
  - The current node is the one where the cursor is located.
