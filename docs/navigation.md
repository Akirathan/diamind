# Navigation

- Navigation is done either by clicking on the bullet of some visible node, or by clicking on a shortcut, like a bookmarked node from the left pane in the hamburger menu.
- Clicking on the bullet of the node _zooms_ into it. The zoomed node becomes the _local root_, see [Data model](data-model.md).
- Whenever navigating / zooming into a node, it is vital to keep the collapse / expand state of the children.

## Top-bar navigation

- hamburger menu in the top left
  - see [Left (navigator) pane](#left-navigator-pane)
- Navigation arrows: Back, Forward, Up.
  - Back and Forward woirk the same as in WEorkflowy
  - Up navigates to the parent node
- breadcrumbs
  - #todo

## Left (navigator) pane

- Like in VSCode, there is a persistent small left pane (around 30px) with icons.
- Contents
  - Explorer
  - Bookmarked nodes
  - Global search
    - default shortcut `Command + Shift + F`
    - inspired by VSCode
    - see [Global search](search.md#global-search)
