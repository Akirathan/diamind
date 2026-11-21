DiaMind

- An offline note taking SW inspired by, Workflowy, Obsidian and VSCode.
- motivation
  - I mostly use Workflowy for note taking, but there is a lot of stuff that I am missing, like VIM-like editing, offline-first.
  - Workflowy has a very slow startup time.
  - I also don't like the subscription obviously.
  - Obsidian also does not satisfy all my needs
  - VSCode also does not satisfy all my needs.
  - Hence, I want to create a mixture of all these three software plus few stuff from my own personal workflow.
- Tech stack
  - Electron
    - React
    - TypeScript
    - TailWindCSS v4
    - vite + vitest
    - playwright for end-to-end tests.
    - prettier
    - SQLite (better-sqlite3) via drizzle, in the main process only.
    - CodeMirror 6 for text editing.
  - Vim key bindings are postponed.
  - Only one window at the start.
- Develop
  - Do frequent commits with brief and clear descriptions.
  - Split long source files (say more than 1000 lines) into multiple ones with clear names.
  - Unit test whatever makes sense to unit test. 
  - Introduce playwright end-to-end tests.
    - No screenshot comparisons.
  - Keep the comments in the code brief and clear. Do not comment self-explaining code. Avoid unnecessary and duplicate comments.
  - Prefer Tailwind classes. If inevitable, use scoped CSS modules, instead of global CSS files.
    - Use global CSS files only if there is a style that is ahred by multiple components.
  - Will be hosted as a public GH repo under `Akirathan/diamind` .
  - Every modification should be merged as a PR
    - Only docs changes can be pushed directly to `main` .
  - At the beginning, do not introduce GH actions - I want to save GH actions time.
    - typecheck, unit tests, e2e tests and formatting should be done locally so far.

## Docs

Detailed descriptions are in the `docs` folder:

- [Data model](docs/data-model.md)
- [Storage](docs/storage.md) - in-memory model, SQLite schema, commands, write path
- [Command palette](docs/command-palette.md)
- [Search](docs/search.md) - find in zoomed node (`Cmd + F`) and global search (`Cmd + Shift + F`)
- [Jump to](docs/jump-to.md)
- [Navigation](docs/navigation.md) - zooming, top-bar navigation, left (navigator) pane
- [Node editing](docs/node-editing.md) - context menu, indent / unindent, indent lines
- [Text editing](docs/text-editing.md) - WYSIWYG markdown, links
- [Sticky scroll](docs/sticky-scroll.md)
- [Filter](docs/filter.md)

## Other features

- Cmdline
  - `diamind`  should also be launchable from cmd line.
- Scrollbar is always visible and is rectangular.
  - Inspired by VSCode.
- Tabs
  - 
- Calendar and dates
  - 
- Export to markdown
  - Attachment node
    - 
- Import
  - 
- Preferences and logs are stored in local directory, by default, `~/.local/share/diamind` .
