# Search

## Find in zoomed node

- `Command + F`  - search in currently zoomed node
- design inspiration from VSCode
- displays found text as gutters on scrollbar
- has "next match" and "previous match" arrows.

## Global search

- Triggered by `Cmd + Shift + F` 
- Inspired by VSCode.
- Opens a *global search left pane*.
- Format of the card rows is the same as in [Jump to](jump-to.md), that is:
  - The (partial) substring match highlighted in trimmed text of the node
  - navigation to the text node - breadcrumbs.
- Right click on the result card row brings a context menu with:
  - Navigate to node
  - Navigate to parent
- Additional options to search:
  - parent_node_text
    - if filled, will only match a text node that is under a parent with `parent_node_text` . Empty by default.
    - Does not have to be an immediate parent. Search should be done up to the root.
