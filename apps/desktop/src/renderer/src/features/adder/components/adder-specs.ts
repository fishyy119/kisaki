/**
 * Adder specs for the shared entity adder dialog.
 *
 * Every entity is added through the same scraper-driven workflow; the spec
 * owns the searcher component, the typed ingest IPC submission and the
 * task-run output projection.
 */

import type { Component } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import type { ContentEntityType } from '@shared/common'
import type { ExternalId } from '@shared/identity'
import {
  type IngestAddAnimeFromScraperResult,
  type IngestAddCharacterFromScraperResult,
  type IngestAddCompanyFromScraperResult,
  type IngestAddGameFromScraperResult,
  type IngestAddPersonFromScraperResult
} from '@shared/ingest/add'
import { AnimeSearcher } from '@renderer/components/shared/anime'
import { CharacterSearcher } from '@renderer/components/shared/character'
import { CompanySearcher } from '@renderer/components/shared/company'
import { GameSearcher } from '@renderer/components/shared/game'
import { PersonSearcher } from '@renderer/components/shared/person'

interface SubmitOutcome {
  success: boolean
  data?: { runId: string }
  error?: string
}

export interface AdderSpec {
  searcher: Component
  /** Selection payload key holding the picked entry's display name. */
  selectionNameKey: string
  submit: (
    profileId: string,
    lookup: { name: string; knownIds: ExternalId[] },
    options: { targetCollectionId?: string }
  ) => Promise<SubmitOutcome>
  /** Projects the created entity id out of the task-run output. */
  extractId: (output: unknown) => string | undefined
}

export const ADDER_SPECS: Record<ContentEntityType, AdderSpec> = {
  game: {
    searcher: GameSearcher,
    selectionNameKey: 'gameName',
    submit: (profileId, lookup, options) =>
      ipcManager.invoke('ingest:add-game-from-scraper', profileId, lookup, options),
    extractId: (output) => (output as IngestAddGameFromScraperResult | undefined)?.gameId
  },
  anime: {
    searcher: AnimeSearcher,
    selectionNameKey: 'animeName',
    submit: (profileId, lookup, options) =>
      ipcManager.invoke('ingest:add-anime-from-scraper', profileId, lookup, options),
    extractId: (output) => (output as IngestAddAnimeFromScraperResult | undefined)?.animeId
  },
  character: {
    searcher: CharacterSearcher,
    selectionNameKey: 'characterName',
    submit: (profileId, lookup, options) =>
      ipcManager.invoke('ingest:add-character-from-scraper', profileId, lookup, options),
    extractId: (output) => (output as IngestAddCharacterFromScraperResult | undefined)?.characterId
  },
  person: {
    searcher: PersonSearcher,
    selectionNameKey: 'personName',
    submit: (profileId, lookup, options) =>
      ipcManager.invoke('ingest:add-person-from-scraper', profileId, lookup, options),
    extractId: (output) => (output as IngestAddPersonFromScraperResult | undefined)?.personId
  },
  company: {
    searcher: CompanySearcher,
    selectionNameKey: 'companyName',
    submit: (profileId, lookup, options) =>
      ipcManager.invoke('ingest:add-company-from-scraper', profileId, lookup, options),
    extractId: (output) => (output as IngestAddCompanyFromScraperResult | undefined)?.companyId
  }
}
