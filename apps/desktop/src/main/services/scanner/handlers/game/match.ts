import { createLogger } from '@main/log'
import { promises as fs } from 'fs'
import path from 'path'
import type { EntityEntry } from '@shared/scanner'
import type { ScannerPhash } from '../../phash'
import { GAME_PHASH_INDEX } from '../../types'
import type { MatchedGame } from './types'

const log = createLogger('Scanner')

// Windows executable extensions
const EXECUTABLE_EXTENSIONS = ['.exe', '.bat', '.cmd']

function isExecutable(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return EXECUTABLE_EXTENSIONS.includes(ext)
}

async function scanForExecutables(folderPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true })
    const executables: string[] = []

    for (const entry of entries) {
      if (entry.isFile() && isExecutable(entry.name)) {
        executables.push(path.join(folderPath, entry.name))
      }
    }

    return executables
  } catch (error) {
    log.error('Failed to scan folder.', { folderPath: folderPath, error: error })
    return []
  }
}

/**
 * Match game entity against phash database.
 */
export async function matchGameEntity(
  entity: EntityEntry,
  phash: ScannerPhash,
  options: { enablePhash?: boolean } = {}
): Promise<MatchedGame> {
  const enablePhash = options.enablePhash ?? true

  // Try icon phash matching from executables.
  if (enablePhash) {
    const executablePaths = await scanForExecutables(entity.path)
    if (executablePaths.length === 0) {
      return { gameName: entity.extractedName, externalIds: [], matchSource: 'folder-name' }
    }

    const { match } = await phash.findBestPhashDbMatchFromFiles({
      index: GAME_PHASH_INDEX,
      filePaths: executablePaths
    })

    if (match) {
      if (match.distance === 0) {
        log.info('Found exact phash match.', {
          matchRecordName: match.record.name,
          matchRecordExternalIdsLength: match.record.externalIds.length
        })
      } else {
        log.info('Found phash match.', {
          matchRecordName: match.record.name,
          matchDistance: match.distance,
          matchRecordExternalIdsLength: match.record.externalIds.length
        })
      }

      return {
        gameName: match.record.name,
        externalIds: match.record.externalIds,
        matchSource: 'phash'
      }
    }
  }

  // Fall back to folder name matching
  return { gameName: entity.extractedName, externalIds: [], matchSource: 'folder-name' }
}
