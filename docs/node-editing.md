# Node editing

- When hovering over a node (on a line), bullet point and three dots should be displayed to the left of the node.
- Bullet point enables drag-and-drop of the node
- Three dots gives a context menu for the node:
  - Turn Into -> Bullets, Paragraph, Code block, Heading 1, Heading 2, Heading 3, Divider
  - Complete / Uncomplete, see [Completed nodes](completed.md)
- Pasting text with several lines:
  - The first line is inserted at the cursor. Each further line becomes a new sibling below.
  - The text after the cursor goes to the end of the last line.
  - Blank lines are dropped.
- Dropped text with line breaks gets spaces instead of them. A node never contains a line break in its text.
- Hiting `Tab` on any position in the node _indents_ it.
  - If the new parent is collapsed, it is expanded, so the node stays visible.
- Hitting `Shift + Tab` on any position in the node _unindents_ it.
- Hitting `Enter` in a node with text:
  - At the end of the text: a new empty sibling is created below the node.
    - If the node has expanded children, a new empty first child is created instead.
    - If the new node would be followed only by an empty last child, no node is created. The cursor moves to that empty child instead.
  - At the beginning of the text: a new empty sibling is created above the node. The node keeps its id.
  - In the middle of the text: the node is _split_. The text after the cursor moves to a new sibling below the node.
    - The original node keeps its id, `created_at`, format, note, attributes and children.
- Hitting `Enter` with selected text first deletes the selected text. If the whole text is selected, it does nothing else.
- A new node created by `Enter` or by pasting in a paragraph is a paragraph. In a node of any other format it is a bullet.
- Hitting `Enter` in an empty node:
  - If the node is the last child, it is _unindented_.
    - If the node is a child of the global root or of the local root, nothing happens.
    - If the unindent would make the last two children of the new parent empty, nothing happens. #todo revisit this corner case.
  - If the node is not the last child, a new empty sibling is created below it.
  - Follows the rule about empty siblings in [Data model](data-model.md).
- Hitting `Backspace` at the beginning of a node merges it into the previous visible node (the _upper node_).
  - The upper node keeps its id, `created_at` and format.
  - The text of the merged node is appended to the text of the upper node.
  - The children of the merged node are appended to the children of the upper node.
  - The note of the merged node is appended to the note of the upper node, see [Notes](notes.md).
  - Attributes of the merged node are added to the upper node. If both have the same key, the value of the upper node wins.
- `Up` / `Down` on the first / last line of a node moves the cursor to the previous / next visible node.
  - The cursor goes to the beginning of that node. The horizontal position is not kept.
- Attachment nodes have no text cursor. When the cursor moves to an attachment node (`Up` / `Down`), the node is _selected_ (highlighted).
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
  - The line of a node starts below its whole text (also when the text wraps to more lines) and ends at its last visible descendant.
  - The local root has no indent line.
- A node with some children has an arrow displayed to the left of the bullet point with which you can expand or collapse the children
  - The arrow is always visible, not only on hover.
  - A collapsed node has a ring around the bullet.
  - If the cursor is inside the subtree that collapses, it moves to the end of the text of the collapsed node.
- Hovering over the end of the indent line reveals a plus icon.
  - Clicking on the plus icon will add a node to the end of the indent line.
  - A newly created node is always of a bullet format.
- The _current indent line_ is highlighted.
  - The current indent line is the one that belongs to the parent node of the current node.
    - If the parent is the local root, no line is highlighted.
  - The current node is the one where the cursor is located.
    - It stays current when the focus leaves the outline (e.g. to another window), until another node gets the cursor.
