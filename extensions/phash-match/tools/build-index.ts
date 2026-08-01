/**
 * Builds a pHash index database from a JSONL description file.
 *
 * Usage:
 *   pnpm build-index --input <entries.jsonl> --out <game-index.db>
 *
 * Each JSONL line describes one entry:
 *   { "id": string, "name": string, "externalIds": [{ "source": string, "id": string }], "icon": string }
 *
 * `icon` is a PNG file path resolved relative to the JSONL file. Hashes are
 * computed with the same algorithm module the extension matches with, which
 * keeps generated data and runtime matching same-origin by construction.
 */

import { readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { DatabaseSync } from 'node:sqlite'
import { computePhashFromPng, phashToBytes, PHASH_ALGORITHM_VERSION } from '../src/host/phash'
import { GAME_INDEX_MEDIA_TYPE, PHASH_INDEX_FORMAT_VERSION } from '../src/host/store'

interface IndexEntryInput {
  id: string
  name: string
  externalIds: Array<{ source: string; id: string }>
  icon: string
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const inputPath = path.resolve(args.input)
  const outputPath = path.resolve(args.out)
  const iconBaseDir = path.dirname(inputPath)

  const entries = parseEntries(await readFile(inputPath, 'utf8'))
  const stagingPath = `${outputPath}.building`
  await rm(stagingPath, { force: true })

  const db = new DatabaseSync(stagingPath)
  try {
    db.exec(
      `CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
       CREATE TABLE entries (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         external_ids TEXT NOT NULL,
         phash BLOB NOT NULL
       ) STRICT;`
    )

    const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)')
    insertMeta.run('format_version', String(PHASH_INDEX_FORMAT_VERSION))
    insertMeta.run('algorithm_version', String(PHASH_ALGORITHM_VERSION))
    insertMeta.run('media_type', GAME_INDEX_MEDIA_TYPE)
    insertMeta.run('generated_at', new Date().toISOString())

    const insertEntry = db.prepare(
      'INSERT INTO entries (id, name, external_ids, phash) VALUES (?, ?, ?, ?)'
    )
    let flatIconCount = 0

    for (const entry of entries) {
      const iconPng = await readFile(path.resolve(iconBaseDir, entry.icon))
      const hash = computePhashFromPng(iconPng)
      if (hash === 0n) {
        flatIconCount += 1
        console.warn(`Skipped "${entry.id}": icon has no luminance structure.`)
        continue
      }

      insertEntry.run(entry.id, entry.name, JSON.stringify(entry.externalIds), phashToBytes(hash))
    }

    db.close()
    await rm(outputPath, { force: true })
    await rename(stagingPath, outputPath)
    console.log(
      `Wrote ${entries.length - flatIconCount} entries to ${outputPath} ` +
        `(format v${PHASH_INDEX_FORMAT_VERSION}, algorithm v${PHASH_ALGORITHM_VERSION}).`
    )
  } catch (error) {
    db.close()
    await rm(stagingPath, { force: true })
    throw error
  }
}

function parseArgs(argv: readonly string[]): { input: string; out: string } {
  const values = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]
    const value = argv[i + 1]
    if ((key !== '--input' && key !== '--out') || value === undefined) {
      throw new Error('Usage: build-index --input <entries.jsonl> --out <game-index.db>')
    }
    values.set(key.slice(2), value)
  }

  const input = values.get('input')
  const out = values.get('out')
  if (!input || !out) {
    throw new Error('Usage: build-index --input <entries.jsonl> --out <game-index.db>')
  }

  return { input, out }
}

function parseEntries(jsonl: string): IndexEntryInput[] {
  const entries: IndexEntryInput[] = []
  const seenIds = new Set<string>()
  const lines = jsonl.split('\n')

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (!line) {
      continue
    }

    const value = JSON.parse(line) as Partial<IndexEntryInput>
    if (
      typeof value.id !== 'string' ||
      !value.id ||
      typeof value.name !== 'string' ||
      !value.name ||
      typeof value.icon !== 'string' ||
      !value.icon ||
      !Array.isArray(value.externalIds) ||
      value.externalIds.some(
        (external) => typeof external?.source !== 'string' || typeof external?.id !== 'string'
      )
    ) {
      throw new Error(`Line ${i + 1} is not a valid index entry.`)
    }
    if (seenIds.has(value.id)) {
      throw new Error(`Line ${i + 1} duplicates entry id "${value.id}".`)
    }

    seenIds.add(value.id)
    entries.push(value as IndexEntryInput)
  }

  return entries
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
