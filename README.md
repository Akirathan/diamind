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
| `npm run db:generate`  | Generate a migration from the DB schema |

### Database

- The schema is in `src/main/db/schema.ts`. After a change, run `npm run db:generate` and commit the new files in `src/main/db/migrations/`. The app applies them at startup.
- `better-sqlite3` ships prebuilt [Node-API](https://nodejs.org/api/n-api.html) binaries. Node-API is ABI-stable, so the same binary loads in Electron and in plain Node (vitest). No rebuild for Electron is necessary.
- `npm run bench:startup -- <count>` measures the startup read of `<count>` generated nodes.

### Environment variables

Data is stored in `~/.local/share/diamind`. A packaged app ignores `DIAMIND_SEED_NODES` and `DIAMIND_HIDDEN`.

| Variable             | What it does                                                   |
| -------------------- | -------------------------------------------------------------- |
| `DIAMIND_DATA_DIR`   | Use another data directory                                     |
| `DIAMIND_SEED_NODES` | Start with this number of generated nodes                      |
| `DIAMIND_HIDDEN`     | `1` hides the window. Default in e2e tests; `0` shows it there |

## License

[Apache License 2.0](LICENSE)
