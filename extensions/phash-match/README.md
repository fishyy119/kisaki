# pHash Match

Built-in Kisaki extension that upgrades scanner matches with executable-icon
perceptual hashing. When a scan run only produces a baseline folder-name
match, this extension hashes the OS icons of `.exe` files inside the entry
directory and looks them up in a local pHash index; a hit rewrites the match
name, external ids, and match source before ingest.

## Architecture

- `src/host/index.ts` activates the extension and taps the
  `scanner.entry.matched` waterfall hook.
- `src/host/matcher.ts` discovers executables, reads their icons through the
  `kisaki.files.getFileIcon` capability, and asks the index for the best
  Hamming match (max distance 5). Entries that already carry a non-baseline
  match source pass through untouched.
- `src/host/phash.ts` is the versioned pHash algorithm (PNG decode, alpha
  composite over black, BT.601 luma, 32x32 area resample, DCT-II, 8x8
  low-frequency block, mean threshold). Both the runtime matcher and the
  index builder use this module, so index data and matching are same-origin
  by construction.
- `src/host/store.ts` reads the index database through `node:sqlite` (no
  native dependencies). Hashes are held in typed arrays for linear scans;
  matched rows are fetched lazily by rowid. The store fingerprints the file
  and reloads transparently when the index is replaced on disk.

## Index database

The index lives in the extension data directory as `game-index.db`:

```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  external_ids TEXT NOT NULL, -- JSON array of { source, id }
  phash BLOB NOT NULL         -- 8-byte big-endian 64-bit hash
) STRICT;
```

`meta` must declare `format_version`, `algorithm_version`, and `media_type`
values matching the extension build; incompatible indexes degrade to an empty
store with a logged warning. When no index file is present the extension is
idle and scans are unaffected.

Build an index from a JSONL description plus PNG icon files:

```bash
pnpm build-index --input entries.jsonl --out game-index.db
```

Each JSONL line is
`{ "id", "name", "externalIds": [{ "source", "id" }], "icon": "./icons/x.png" }`
with `icon` resolved relative to the JSONL file.

## Evolution notes

- Index data is intentionally decoupled from the extension package: the
  planned delivery model is a bundled-or-downloaded index in the extension
  data directory (the store already reload-follows file replacement), so a
  future remote-update job only needs to download, verify, and atomically
  rename the file.
- Additional media types get their own index files and matcher wiring; the
  `meta.media_type` handshake keeps files from being cross-wired.
- Any change to hash bits requires bumping `PHASH_ALGORITHM_VERSION` and
  regenerating index data.
