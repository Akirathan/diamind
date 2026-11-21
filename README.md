# DiaMind

An offline note taking app inspired by Workflowy, Obsidian and VSCode.

Work in progress. See [docs](docs) for the specs.

## Development

Requires Node.js 24 (see `.nvmrc`).

```sh
npm install
npm run dev          # start the app with hot reload
npm run check        # format check, typecheck, unit tests, e2e tests
```

| Script                 | What it does                            |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Start the app in development mode       |
| `npm run build`        | Build into `out/`                       |
| `npm start`            | Start the built app                     |
| `npm run typecheck`    | Typecheck main, preload and renderer    |
| `npm test`             | Unit tests (vitest)                     |
| `npm run test:e2e`     | Build and run e2e tests (Playwright)    |
| `npm run format`       | Format all files (Prettier)             |
| `npm run format:check` | Check formatting                        |
| `npm run check`        | All of the checks above, as before a PR |

Data is stored in `~/.local/share/diamind`. Set `DIAMIND_DATA_DIR` to use another directory.

## License

[Apache License 2.0](LICENSE)
