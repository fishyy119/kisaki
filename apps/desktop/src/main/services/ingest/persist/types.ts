import log from 'electron-log/main'
import type { DbService } from '@main/services/db'
import type {
  IngestAddCharacterFromScraperResult,
  IngestAddCompanyFromScraperResult,
  IngestAddGameFromScraperResult,
  IngestAddPersonFromScraperResult,
  IngestWarning
} from '@shared/ingest'
import { characters, companies, games, persons } from '@shared/db'

export type PendingAssetTask =
  | {
      type: 'game'
      gameId: string
      field: 'coverFile' | 'backdropFile' | 'logoFile' | 'iconFile'
      url: string
    }
  | {
      type: 'person'
      personId: string
      url: string
    }
  | {
      type: 'company'
      companyId: string
      url: string
    }
  | {
      type: 'character'
      characterId: string
      url: string
    }

export interface PersistGameGraphResult extends IngestAddGameFromScraperResult {
  pendingAssets: PendingAssetTask[]
}

export interface PersistPersonGraphResult extends IngestAddPersonFromScraperResult {
  pendingAssets: PendingAssetTask[]
}

export interface PersistCompanyGraphResult extends IngestAddCompanyFromScraperResult {
  pendingAssets: PendingAssetTask[]
}

export interface PersistCharacterGraphResult extends IngestAddCharacterFromScraperResult {
  pendingAssets: PendingAssetTask[]
}

export function pickFirstAssetUrl(candidates: string[] | undefined): string | undefined {
  if (!candidates?.length) return undefined

  for (const candidate of candidates) {
    const trimmed = candidate.trim()
    if (trimmed) {
      return trimmed
    }
  }

  return undefined
}

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
  pendingAssets: PendingAssetTask[]
): Promise<IngestWarning[]> {
  const warningResults = await Promise.all(
    pendingAssets.map(async (asset): Promise<IngestWarning | undefined> => {
      try {
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
        const message = `Asset persistence failed for ${describePendingAsset(asset)}.`
        log.warn(`[IngestPersist] ${message}`, error)
        return {
          code: 'asset-persist-failed',
          message
        }
      }
    })
  )

  return warningResults.filter((warning): warning is IngestWarning => warning !== undefined)
}
