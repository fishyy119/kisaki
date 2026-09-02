/**
 * Add-entry specs for the shared add-entry dialog.
 *
 * Every entity is added through the same scraper-driven workflow; the spec
 * owns the typed ingest IPC submission and the task-run output projection.
 */

import { ipcManager } from '@renderer/core/ipc'
import type { ContentEntityType } from '@shared/entity-types'
import type { ScraperLookup } from '@shared/scraper'
import {
  type IngestAddAnimeFromScraperResult,
  type IngestAddCharacterFromScraperResult,
  type IngestAddComicFromScraperResult,
  type IngestAddCompanyFromScraperResult,
  type IngestAddGameFromScraperResult,
  type IngestAddNovelFromScraperResult,
  type IngestAddPersonFromScraperResult
} from '@shared/ingest/add'

interface SubmitOutcome {
  success: boolean
  data?: { runId: string }
  error?: string
}

export interface AddEntrySpec {
  /**
   * Submits the lookup the searcher composed. Entity-specific lookup facts ride
   * along inside it, so the dialog never has to know about them.
   */
  submit: (
    profileId: string,
    lookup: ScraperLookup,
    options: { targetCollectionId?: string }
  ) => Promise<SubmitOutcome>
  /** Projects the created entity id out of the task-run output. */
  extractId: (output: unknown) => string | undefined
}

export const ADD_ENTRY_SPECS: Record<ContentEntityType, AddEntrySpec> = {
  game: {
    submit: (profileId, lookup, options) =>
      ipcManager.invoke('ingest:add-game-from-scraper', profileId, lookup, options),
    extractId: (output) => (output as IngestAddGameFromScraperResult | undefined)?.gameId
  },
  anime: {
    submit: (profileId, lookup, options) =>
      ipcManager.invoke('ingest:add-anime-from-scraper', profileId, lookup, options),
    extractId: (output) => (output as IngestAddAnimeFromScraperResult | undefined)?.animeId
  },
  comic: {
    submit: (profileId, lookup, options) =>
      ipcManager.invoke('ingest:add-comic-from-scraper', profileId, lookup, options),
    extractId: (output) => (output as IngestAddComicFromScraperResult | undefined)?.comicId
  },
  novel: {
    submit: (profileId, lookup, options) =>
      ipcManager.invoke('ingest:add-novel-from-scraper', profileId, lookup, options),
    extractId: (output) => (output as IngestAddNovelFromScraperResult | undefined)?.novelId
  },
  character: {
    submit: (profileId, lookup, options) =>
      ipcManager.invoke('ingest:add-character-from-scraper', profileId, lookup, options),
    extractId: (output) => (output as IngestAddCharacterFromScraperResult | undefined)?.characterId
  },
  person: {
    submit: (profileId, lookup, options) =>
      ipcManager.invoke('ingest:add-person-from-scraper', profileId, lookup, options),
    extractId: (output) => (output as IngestAddPersonFromScraperResult | undefined)?.personId
  },
  company: {
    submit: (profileId, lookup, options) =>
      ipcManager.invoke('ingest:add-company-from-scraper', profileId, lookup, options),
    extractId: (output) => (output as IngestAddCompanyFromScraperResult | undefined)?.companyId
  }
}
