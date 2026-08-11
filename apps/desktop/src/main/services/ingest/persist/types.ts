import type {
  IngestAddAnimeResult,
  IngestAddCharacterResult,
  IngestAddCompanyResult,
  IngestAddGameResult,
  IngestAddPersonResult
} from '@shared/ingest/add'
import type { PendingAssetTask } from '../assets'

export interface PersistGameGraphResult extends IngestAddGameResult {
  pendingAssets: PendingAssetTask[]
}

export interface PersistAnimeGraphResult extends IngestAddAnimeResult {
  pendingAssets: PendingAssetTask[]
}

export interface PersistPersonGraphResult extends IngestAddPersonResult {
  pendingAssets: PendingAssetTask[]
}

export interface PersistCompanyGraphResult extends IngestAddCompanyResult {
  pendingAssets: PendingAssetTask[]
}

export interface PersistCharacterGraphResult extends IngestAddCharacterResult {
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
