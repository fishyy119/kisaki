/**
 * Scanner match enrichment.
 *
 * Taps the `scanner.entry.matched` waterfall and upgrades baseline
 * folder-name matches: executables inside the entry directory are hashed
 * through their OS icons and matched against the pHash index. Entries that
 * already carry a better match source pass through untouched.
 */

import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { kisaki, type ExtensionLogger, type ScannerMatchedEntry } from '@kisaki3/extension-sdk'
import { computePhashFromPng } from './phash'
import type { PhashIndexStore } from './store'

const EXECUTABLE_EXTENSION = '.exe'
/** Bounds capability calls for pathological directories full of executables. */
const MAX_EXECUTABLES_PER_ENTRY = 16
const MAX_MATCH_DISTANCE = 5
const BASELINE_MATCH_SOURCE = 'folder-name'
const PHASH_MATCH_SOURCE = 'phash'

export interface GameEntryMatcherOptions {
  store: PhashIndexStore
  logger: ExtensionLogger
}

export class GameEntryMatcher {
  constructor(private readonly options: GameEntryMatcherOptions) {}

  async enrich(value: ScannerMatchedEntry): Promise<ScannerMatchedEntry> {
    // Icon pHashes describe game covers; a stray .exe inside an anime folder
    // must never turn the entry into a game match.
    if (value.mediaType !== 'game') {
      return value
    }

    if (value.matchSource !== BASELINE_MATCH_SOURCE || this.options.store.size === 0) {
      return value
    }

    const executables = await findExecutables(value.entry.path)
    if (executables.length === 0) {
      return value
    }

    const probes = await this.computeIconPhashes(executables)
    const match = this.options.store.findBestMatch(probes, MAX_MATCH_DISTANCE)
    if (!match) {
      return value
    }

    this.options.logger.info('Matched scanner entry by executable icon pHash.', {
      entry: value.entry.originalName,
      matchedName: match.record.name,
      distance: match.distance,
      externalIdCount: match.record.externalIds.length
    })

    return {
      ...value,
      name: match.record.name,
      externalIds: match.record.externalIds,
      matchSource: PHASH_MATCH_SOURCE
    }
  }

  private async computeIconPhashes(executables: readonly string[]): Promise<bigint[]> {
    const probes: bigint[] = []

    for (const filePath of executables) {
      try {
        const icon = await kisaki.files.getFileIcon(filePath, { size: 'large' })
        if (!icon) {
          continue
        }

        const hash = computePhashFromPng(icon)
        if (hash === 0n) {
          // A flat icon has no luminance structure and would only produce
          // false positives against other flat icons.
          continue
        }

        probes.push(hash)
      } catch (error) {
        this.options.logger.warn('Failed to compute an executable icon pHash.', {
          file: path.basename(filePath),
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return probes
  }
}

async function findExecutables(entryPath: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(entryPath, { withFileTypes: true })
  } catch {
    return []
  }

  return entries
    .filter(
      (entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === EXECUTABLE_EXTENSION
    )
    .map((entry) => path.join(entryPath, entry.name))
    .sort((left, right) => left.localeCompare(right, 'en'))
    .slice(0, MAX_EXECUTABLES_PER_ENTRY)
}
