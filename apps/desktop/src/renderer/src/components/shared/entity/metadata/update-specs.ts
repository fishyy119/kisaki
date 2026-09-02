/**
 * Metadata-update specs for the shared scraper update dialogs.
 *
 * Every entity exposes the same update workflow (pick scraper result, choose
 * surfaces, choose policies); the spec owns the per-entity surface vocabulary
 * and typed IPC submission.
 */

import { ipcManager } from '@renderer/core/ipc'
import type { Messages } from '@shared/i18n'
import {
  ANIME_UPDATE_SURFACE_KEYS,
  CHARACTER_UPDATE_SURFACE_KEYS,
  COMIC_UPDATE_SURFACE_KEYS,
  COMPANY_UPDATE_SURFACE_KEYS,
  GAME_UPDATE_SURFACE_KEYS,
  NOVEL_UPDATE_SURFACE_KEYS,
  PERSON_UPDATE_SURFACE_KEYS,
  type AnimeBatchUpdateRequest,
  type AnimeUpdateRequest,
  type CharacterBatchUpdateRequest,
  type CharacterUpdateRequest,
  type ComicBatchUpdateRequest,
  type ComicUpdateRequest,
  type CompanyBatchUpdateRequest,
  type CompanyUpdateRequest,
  type GameBatchUpdateRequest,
  type GameUpdateRequest,
  type IngestBatchUpdateRequest,
  type IngestUpdateRequest,
  type NovelBatchUpdateRequest,
  type NovelUpdateRequest,
  type PersonBatchUpdateRequest,
  type PersonUpdateRequest
} from '@shared/ingest/update'
import type { ContentEntityType } from '@shared/entity-types'

interface SubmitOutcome {
  success: boolean
  error?: string
}

export interface MetadataUpdateSpec {
  /** Update surfaces in display order; also the source of valid values. */
  surfaceKeys: readonly string[]
  surfaceLabels: (m: Messages) => Record<string, string>
  submit: (request: IngestUpdateRequest<string>) => Promise<SubmitOutcome>
  submitBatch: (request: IngestBatchUpdateRequest<string>) => Promise<SubmitOutcome>
}

export const METADATA_UPDATE_SPECS: Record<ContentEntityType, MetadataUpdateSpec> = {
  game: {
    surfaceKeys: GAME_UPDATE_SURFACE_KEYS,
    surfaceLabels: (m) => ({
      name: m.library.fields.name,
      originalName: m.library.fields.originalName,
      aliases: m.library.fields.aliases,
      releaseDate: m.library.fields.releaseDate,
      description: m.library.fields.description,
      externalSites: m.library.fields.externalSites,
      externalIds: m.library.fields.externalIds,
      tags: m.library.fields.tags,
      person: m.library.entities.person,
      company: m.library.entities.company,
      character: m.library.entities.character,
      characterPerson: m.library.fields.characterPersons,
      relatedEntries: m.library.fields.relatedEntries,
      covers: m.library.fields.covers,
      backdrops: m.library.fields.backdrops,
      logos: m.library.fields.logos,
      icons: m.library.fields.icons
    }),
    submit: (request) =>
      ipcManager.invoke('ingest:update-game-from-scraper', request as GameUpdateRequest),
    submitBatch: (request) =>
      ipcManager.invoke('ingest:batch-update-game-from-scraper', request as GameBatchUpdateRequest)
  },
  anime: {
    surfaceKeys: ANIME_UPDATE_SURFACE_KEYS,
    surfaceLabels: (m) => ({
      name: m.library.fields.name,
      originalName: m.library.fields.originalName,
      aliases: m.library.fields.aliases,
      releaseDate: m.library.fields.releaseDate,
      description: m.library.fields.description,
      format: m.library.fields.format,
      totalEpisodes: m.library.fields.totalEpisodes,
      externalSites: m.library.fields.externalSites,
      externalIds: m.library.fields.externalIds,
      tags: m.library.fields.tags,
      episodes: m.library.fields.episodes,
      person: m.library.entities.person,
      company: m.library.entities.company,
      character: m.library.entities.character,
      characterPerson: m.library.fields.characterPersons,
      relatedEntries: m.library.fields.relatedEntries,
      covers: m.library.fields.covers,
      backdrops: m.library.fields.backdrops,
      logos: m.library.fields.logos
    }),
    submit: (request) =>
      ipcManager.invoke('ingest:update-anime-from-scraper', request as AnimeUpdateRequest),
    submitBatch: (request) =>
      ipcManager.invoke(
        'ingest:batch-update-anime-from-scraper',
        request as AnimeBatchUpdateRequest
      )
  },
  comic: {
    surfaceKeys: COMIC_UPDATE_SURFACE_KEYS,
    surfaceLabels: (m) => ({
      name: m.library.fields.name,
      originalName: m.library.fields.originalName,
      aliases: m.library.fields.aliases,
      releaseDate: m.library.fields.releaseDate,
      description: m.library.fields.description,
      format: m.library.fields.format,
      totalVolumes: m.library.fields.totalVolumes,
      totalChapters: m.library.fields.totalChapters,
      externalSites: m.library.fields.externalSites,
      externalIds: m.library.fields.externalIds,
      tags: m.library.fields.tags,
      chapters: m.library.fields.chapters,
      person: m.library.entities.person,
      company: m.library.entities.company,
      character: m.library.entities.character,
      characterPerson: m.library.fields.characterPersons,
      relatedEntries: m.library.fields.relatedEntries,
      covers: m.library.fields.covers,
      backdrops: m.library.fields.backdrops,
      logos: m.library.fields.logos
    }),
    submit: (request) =>
      ipcManager.invoke('ingest:update-comic-from-scraper', request as ComicUpdateRequest),
    submitBatch: (request) =>
      ipcManager.invoke(
        'ingest:batch-update-comic-from-scraper',
        request as ComicBatchUpdateRequest
      )
  },
  novel: {
    surfaceKeys: NOVEL_UPDATE_SURFACE_KEYS,
    surfaceLabels: (m) => ({
      name: m.library.fields.name,
      originalName: m.library.fields.originalName,
      aliases: m.library.fields.aliases,
      releaseDate: m.library.fields.releaseDate,
      description: m.library.fields.description,
      format: m.library.fields.format,
      totalVolumes: m.library.fields.totalVolumes,
      externalSites: m.library.fields.externalSites,
      externalIds: m.library.fields.externalIds,
      tags: m.library.fields.tags,
      volumes: m.library.fields.volumes,
      person: m.library.entities.person,
      company: m.library.entities.company,
      character: m.library.entities.character,
      characterPerson: m.library.fields.characterPersons,
      relatedEntries: m.library.fields.relatedEntries,
      covers: m.library.fields.covers,
      backdrops: m.library.fields.backdrops,
      logos: m.library.fields.logos
    }),
    submit: (request) =>
      ipcManager.invoke('ingest:update-novel-from-scraper', request as NovelUpdateRequest),
    submitBatch: (request) =>
      ipcManager.invoke(
        'ingest:batch-update-novel-from-scraper',
        request as NovelBatchUpdateRequest
      )
  },
  character: {
    surfaceKeys: CHARACTER_UPDATE_SURFACE_KEYS,
    surfaceLabels: (m) => ({
      name: m.library.fields.name,
      originalName: m.library.fields.originalName,
      aliases: m.library.fields.aliases,
      birthDate: m.library.fields.birthDate,
      gender: m.library.fields.gender,
      age: m.library.fields.age,
      bloodType: m.library.fields.bloodType,
      height: m.library.fields.height,
      weight: m.library.fields.weight,
      bust: m.library.fields.bust,
      waist: m.library.fields.waist,
      hips: m.library.fields.hips,
      cup: m.library.fields.cup,
      description: m.library.fields.description,
      externalSites: m.library.fields.externalSites,
      externalIds: m.library.fields.externalIds,
      tags: m.library.fields.tags,
      person: m.library.entities.person,
      photos: m.library.fields.photos
    }),
    submit: (request) =>
      ipcManager.invoke('ingest:update-character-from-scraper', request as CharacterUpdateRequest),
    submitBatch: (request) =>
      ipcManager.invoke(
        'ingest:batch-update-character-from-scraper',
        request as CharacterBatchUpdateRequest
      )
  },
  person: {
    surfaceKeys: PERSON_UPDATE_SURFACE_KEYS,
    surfaceLabels: (m) => ({
      name: m.library.fields.name,
      originalName: m.library.fields.originalName,
      aliases: m.library.fields.aliases,
      birthDate: m.library.fields.birthDate,
      deathDate: m.library.fields.deathDate,
      gender: m.library.fields.gender,
      description: m.library.fields.description,
      externalSites: m.library.fields.externalSites,
      externalIds: m.library.fields.externalIds,
      tags: m.library.fields.tags,
      photos: m.library.fields.photos
    }),
    submit: (request) =>
      ipcManager.invoke('ingest:update-person-from-scraper', request as PersonUpdateRequest),
    submitBatch: (request) =>
      ipcManager.invoke(
        'ingest:batch-update-person-from-scraper',
        request as PersonBatchUpdateRequest
      )
  },
  company: {
    surfaceKeys: COMPANY_UPDATE_SURFACE_KEYS,
    surfaceLabels: (m) => ({
      name: m.library.fields.name,
      originalName: m.library.fields.originalName,
      foundedDate: m.library.fields.foundedDate,
      description: m.library.fields.description,
      externalSites: m.library.fields.externalSites,
      externalIds: m.library.fields.externalIds,
      tags: m.library.fields.tags,
      logos: m.library.fields.logos
    }),
    submit: (request) =>
      ipcManager.invoke('ingest:update-company-from-scraper', request as CompanyUpdateRequest),
    submitBatch: (request) =>
      ipcManager.invoke(
        'ingest:batch-update-company-from-scraper',
        request as CompanyBatchUpdateRequest
      )
  }
}
