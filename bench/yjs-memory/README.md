# Yjs memory benchmark

Measures the startup cost of keeping the full outline in memory, as plain objects and as a Yjs document.

## Run

Requires Node.js 24 or later (runs TypeScript directly).

```sh
npm install
npm run bench
npm run bench -- --sizes 10000,100000 --edits-per-node 2 --sessions 1000
```

| Option             | Default                       | Meaning                                                 |
| ------------------ | ----------------------------- | ------------------------------------------------------- |
| `--sizes`          | `100000,200000,365000,500000` | Node counts to measure                                  |
| `--edits-per-node` | `2`                           | Text edits in the history, as a multiple of node count  |
| `--sessions`       | `1000`                        | App starts in the history; each gets a new Yjs clientID |
| `--seed`           | `42`                          | Seed for the generated outline                          |

## Variants

- `plain` - JSON array of node objects, loaded into a `Map` by ID.
- `yjs-text` - flat `Y.Map` of nodes; each node is a `Y.Map` with the text as `Y.Text`.
- `yjs-string` - the same, but the text is a plain string (no character-level merge).

Each node has `parentId`, `order`, `text`, `format`, `collapsed`, `createdAt` and `modifiedAt`.
The generated outline has random depth up to 12 levels and texts of 1 to 20 words.

## Columns

- `file MB` - saved snapshot (`JSON` or `Y.encodeStateAsUpdate`); `file v2 MB` is the Yjs v2 encoding.
- `load ms` - parse the snapshot into memory.
- `index ms` - build the sorted children index by parent.
- `search ms` - one substring scan over all texts.
- `heap MB`, `heap B/node` - heap growth after load and index, measured after GC in a fresh process.
- `rss MB` - resident memory of the load process.

## Results

Apple M4 Pro, 48 GB, Node.js 24.22.2, yjs 13.6.33, default options.

| nodes  | variant    | file MB | file v2 MB | load ms | index ms | search ms | heap MB | heap B/node | rss MB |
| ------ | ---------- | ------- | ---------- | ------- | -------- | --------- | ------- | ----------- | ------ |
| 100000 | plain      | 22.2    | -          | 51      | 14       | 7         | 32      | 338         | 217    |
| 100000 | yjs-text   | 34.7    | 26.7       | 1297    | 61       | 84        | 592     | 6205        | 1028   |
| 100000 | yjs-string | 29.3    | 22.0       | 807     | 47       | 46        | 460     | 4826        | 848    |
| 200000 | plain      | 44.3    | -          | 104     | 25       | 7         | 64      | 337         | 314    |
| 200000 | yjs-text   | 71.0    | 53.6       | 3703    | 194      | 217       | 1186    | 6219        | 1857   |
| 200000 | yjs-string | 58.8    | 44.1       | 1772    | 94       | 97        | 920     | 4823        | 1482   |
| 365000 | plain      | 80.9    | -          | 202     | 63       | 12        | 119     | 342         | 535    |
| 365000 | yjs-text   | 130.9   | 98.0       | 5530    | 258      | 326       | 2157    | 6195        | 3251   |
| 365000 | yjs-string | 107.3   | 80.6       | 3156    | 179      | 181       | 1678    | 4819        | 2539   |
| 500000 | plain      | 110.8   | -          | 273     | 79       | 17        | 156     | 328         | 642    |
| 500000 | yjs-text   | 180.0   | 134.3      | 7386    | 301      | 437       | 2954    | 6196        | 4271   |
| 500000 | yjs-string | 147.1   | 110.5      | 4338    | 243      | 246       | 2297    | 4817        | 3288   |
