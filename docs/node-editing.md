# Node editing

- When hovering over a node (on a line), bullet point and three dots should be displayed to the left of the node. 
- Bullet point enables drag-and-drop of the node
- Three dots gives a context menu for the node:
  - Turn Into -> Bullets, Paragraph, Code block, Heading 1, Heading 2, Heading 3, Divider
- Hiting `Tab` on any position in the node *indents* it.
- Hitting `Shift + Tab`  on any position in the node *unindents* it.
- Hitting `Enter` in an empty node:
  - If the node is the last child, it is *unindented*.
  - If the node is not the last child, a new empty sibling is created below it.
  - Follows the rule about empty siblings in [Data model](data-model.md).
- `Up` / `Down` on the first / last line of a node moves the cursor to the previous / next visible node.
  - The cursor goes to the beginning of that node. The horizontal position is not kept.

## Indent lines

- Indent lines are always visible, just like in Workflowy
- A node with some children has an arrow displayed to the left of the bullet point with which you can expand or collapse the children
- Hovering over the end of the indent line reveals a plus icon.
  - Clicking on the plus icon will add a node to the end of the indent line.
  - A newly created node is always of a bullet format.
- The *current indent line* is highlighted.
  - The current indent line is the one that belongs to the parent node of the current node.
  - The current node is the one where the cursor is located.
