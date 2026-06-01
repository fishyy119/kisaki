import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { IngestWarning } from '@shared/ingest'
import { characters, companies, games, persons } from '@shared/db'
import type { PendingAssetTask } from './types'
import { throwIfIngestAborted } from '../types'

const log = createLogger('Ingest')

function describePendingAsset(asset: PendingAssetTask): string {
  switch (asset.type) {
    case 'game':
      return `game ${asset.gameId} (${asset.field})`
    case 'person':
      return `person ${asset.personId} (photoFile)`
    case 'company':
      return `company ${asset.companyId} (logoFile)`
    case 'character':
      return `character ${asset.characterId} (photoFile)`
  }
}

export async function flushPendingAssets(
  dbService: DbService,
  pendingAssets: PendingAssetTask[],
  options?: { signal?: AbortSignal }
): Promise<IngestWarning[]> {
  throwIfIngestAborted(options?.signal)
  const warningResults = await Promise.all(
    pendingAssets.map(async (asset): Promise<IngestWarning | undefined> => {
      try {
        throwIfIngestAborted(options?.signal)
        switch (asset.type) {
          case 'game':
            await dbService.attachment.setFile(games, asset.gameId, asset.field, {
              kind: 'url',
              url: asset.url
            })
            return undefined
          case 'person':
            await dbService.attachment.setFile(persons, asset.personId, 'photoFile', {
              kind: 'url',
              url: asset.url
            })
            return undefined
          case 'company':
            await dbService.attachment.setFile(companies, asset.companyId, 'logoFile', {
              kind: 'url',
              url: asset.url
            })
            return undefined
          case 'character':
            await dbService.attachment.setFile(characters, asset.characterId, 'photoFile', {
              kind: 'url',
              url: asset.url
            })
            return undefined
        }
      } catch (error) {
        throwIfIngestAborted(options?.signal)
        const message = `Asset persistence failed for ${describePendingAsset(asset)}.`
        log.warn('Asset flush warning.', error, { message: message })
        return {
          code: 'asset-persist-failed',
          message
        }
      }
    })
  )

  return warningResults.filter((warning): warning is IngestWarning => warning !== undefined)
}
