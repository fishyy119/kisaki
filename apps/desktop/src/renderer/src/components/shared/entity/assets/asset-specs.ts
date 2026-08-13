/**
 * Asset-slot specs for the shared image asset dialogs.
 *
 * Every entity manages a fixed set of image slots (cover, backdrop, logo,
 * icon, photo). The spec owns the slot list with its presentation and crop
 * constraints plus the typed attachment/scraper adapters, so the dialogs
 * stay entirely spec-driven.
 */

import { eq } from 'drizzle-orm'
import { attachment, db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import type { Messages } from '@shared/i18n'
import type {
  AnimeImageSlot,
  GameImageSlot,
  ScraperCapability,
  ScraperLookup
} from '@shared/scraper'
import { animes, characters, companies, games, persons } from '@shared/db'
import type { TableName } from '@shared/db/table-names'
import type { TableEntityType } from '../entity-tables'

export type AssetFileSource = { kind: 'path'; path: string } | { kind: 'url'; url: string }

export interface AssetSlot {
  type: string
  label: (m: Messages) => string
  description: (m: Messages) => string
  /** Tailwind aspect class used by the selector and preview panes. */
  aspectClass: string
  /** Fixed crop ratio; undefined allows free cropping. */
  cropAspect?: number
  cropAspectLabel?: string
  /** Scraper capability id; also the provider image request slot. */
  searchCapability: ScraperCapability
  /** Tailwind grid class for the search result layout. */
  searchGridClass: string
}

interface SearchOutcome {
  success: boolean
  data?: string[]
  error?: string
}

export interface EntityAssetSpec {
  /** Attachment protocol table segment, also the db-changes table name. */
  attachmentTable: TableName
  slots: AssetSlot[]
  loadEntry: (
    id: string
  ) => Promise<
    { name: string; originalName: string | null; files: Record<string, string | null> } | undefined
  >
  setFile: (id: string, slotType: string, source: AssetFileSource) => Promise<void>
  clearFile: (id: string, slotType: string) => Promise<void>
  /** `capability` is the slot's `searchCapability` value. */
  searchImages: (
    providerId: string,
    lookup: ScraperLookup,
    capability: ScraperCapability
  ) => Promise<SearchOutcome>
}

const COVER_SLOT = (description: (m: Messages) => string): AssetSlot => ({
  type: 'cover',
  label: (m) => m.library.forms.mediaTypes.cover,
  description,
  aspectClass: 'aspect-[3/4]',
  cropAspect: 3 / 4,
  cropAspectLabel: '3:4',
  searchCapability: 'covers',
  searchGridClass: 'grid-cols-4'
})

const BACKDROP_SLOT = (description: (m: Messages) => string): AssetSlot => ({
  type: 'backdrop',
  label: (m) => m.library.forms.mediaTypes.backdrop,
  description,
  aspectClass: 'aspect-video',
  cropAspect: 16 / 9,
  cropAspectLabel: '16:9',
  searchCapability: 'backdrops',
  searchGridClass: 'grid-cols-2'
})

const LOGO_SLOT = (
  description: (m: Messages) => string,
  aspectClass: string
): AssetSlot => ({
  type: 'logo',
  label: (m) => m.library.forms.mediaTypes.logo,
  description,
  aspectClass,
  searchCapability: 'logos',
  searchGridClass: 'grid-cols-2'
})

const ICON_SLOT = (description: (m: Messages) => string): AssetSlot => ({
  type: 'icon',
  label: (m) => m.library.forms.mediaTypes.icon,
  description,
  aspectClass: 'aspect-square',
  cropAspect: 1,
  cropAspectLabel: '1:1',
  searchCapability: 'icons',
  searchGridClass: 'grid-cols-6'
})

const PHOTO_SLOT = (description: (m: Messages) => string): AssetSlot => ({
  type: 'photo',
  label: (m) => m.library.forms.mediaTypes.photo,
  description,
  aspectClass: 'aspect-[3/4]',
  cropAspect: 3 / 4,
  cropAspectLabel: '3:4',
  searchCapability: 'photos',
  searchGridClass: 'grid-cols-4'
})

const GAME_FIELDS = {
  cover: 'coverFile',
  backdrop: 'backdropFile',
  logo: 'logoFile',
  icon: 'iconFile'
} as const

const ANIME_FIELDS = {
  cover: 'coverFile',
  backdrop: 'backdropFile',
  logo: 'logoFile'
} as const

export const ENTITY_ASSET_SPECS: Record<TableEntityType, EntityAssetSpec> = {
  game: {
    attachmentTable: 'games',
    slots: [
      COVER_SLOT((m) => m.library.forms.mediaDescriptions.gameCover),
      BACKDROP_SLOT((m) => m.library.forms.mediaDescriptions.gameBackdrop),
      LOGO_SLOT((m) => m.library.forms.mediaDescriptions.gameLogo, 'aspect-[3/1]'),
      ICON_SLOT((m) => m.library.forms.mediaDescriptions.gameIcon)
    ],
    loadEntry: async (id) => {
      const row = await db.query.games.findFirst({ where: eq(games.id, id) })
      if (!row) return undefined
      return {
        name: row.name,
        originalName: row.originalName,
        files: {
          cover: row.coverFile,
          backdrop: row.backdropFile,
          logo: row.logoFile,
          icon: row.iconFile
        }
      }
    },
    setFile: async (id, slotType, source) => {
      await attachment.setFile(games, id, GAME_FIELDS[slotType as keyof typeof GAME_FIELDS], source)
    },
    clearFile: async (id, slotType) => {
      await attachment.clearFile(games, id, GAME_FIELDS[slotType as keyof typeof GAME_FIELDS])
    },
    searchImages: (providerId, lookup, capability) =>
      ipcManager.invoke(
        'scraper:get-game-provider-images',
        providerId,
        lookup,
        capability as GameImageSlot
      )
  },
  anime: {
    attachmentTable: 'animes',
    slots: [
      COVER_SLOT((m) => m.library.forms.mediaDescriptions.animeCover),
      BACKDROP_SLOT((m) => m.library.forms.mediaDescriptions.animeBackdrop),
      LOGO_SLOT((m) => m.library.forms.mediaDescriptions.animeLogo, 'aspect-[3/1]')
    ],
    loadEntry: async (id) => {
      const row = await db.query.animes.findFirst({ where: eq(animes.id, id) })
      if (!row) return undefined
      return {
        name: row.name,
        originalName: row.originalName,
        files: {
          cover: row.coverFile,
          backdrop: row.backdropFile,
          logo: row.logoFile
        }
      }
    },
    setFile: async (id, slotType, source) => {
      await attachment.setFile(
        animes,
        id,
        ANIME_FIELDS[slotType as keyof typeof ANIME_FIELDS],
        source
      )
    },
    clearFile: async (id, slotType) => {
      await attachment.clearFile(animes, id, ANIME_FIELDS[slotType as keyof typeof ANIME_FIELDS])
    },
    searchImages: (providerId, lookup, capability) =>
      ipcManager.invoke(
        'scraper:get-anime-provider-images',
        providerId,
        lookup,
        capability as AnimeImageSlot
      )
  },
  character: {
    attachmentTable: 'characters',
    slots: [PHOTO_SLOT((m) => m.library.forms.mediaDescriptions.characterPhoto)],
    loadEntry: async (id) => {
      const row = await db.query.characters.findFirst({ where: eq(characters.id, id) })
      if (!row) return undefined
      return {
        name: row.name,
        originalName: row.originalName,
        files: { photo: row.photoFile }
      }
    },
    setFile: async (id, _slotType, source) => {
      await attachment.setFile(characters, id, 'photoFile', source)
    },
    clearFile: async (id) => {
      await attachment.clearFile(characters, id, 'photoFile')
    },
    searchImages: (providerId, lookup) =>
      ipcManager.invoke('scraper:get-character-provider-images', providerId, lookup, 'photos')
  },
  person: {
    attachmentTable: 'persons',
    slots: [PHOTO_SLOT((m) => m.library.forms.mediaDescriptions.personPhoto)],
    loadEntry: async (id) => {
      const row = await db.query.persons.findFirst({ where: eq(persons.id, id) })
      if (!row) return undefined
      return {
        name: row.name,
        originalName: row.originalName,
        files: { photo: row.photoFile }
      }
    },
    setFile: async (id, _slotType, source) => {
      await attachment.setFile(persons, id, 'photoFile', source)
    },
    clearFile: async (id) => {
      await attachment.clearFile(persons, id, 'photoFile')
    },
    searchImages: (providerId, lookup) =>
      ipcManager.invoke('scraper:get-person-provider-images', providerId, lookup, 'photos')
  },
  company: {
    attachmentTable: 'companies',
    slots: [
      {
        ...LOGO_SLOT((m) => m.library.forms.mediaDescriptions.companyLogo, 'aspect-square'),
        searchGridClass: 'grid-cols-4'
      }
    ],
    loadEntry: async (id) => {
      const row = await db.query.companies.findFirst({ where: eq(companies.id, id) })
      if (!row) return undefined
      return {
        name: row.name,
        originalName: row.originalName,
        files: { logo: row.logoFile }
      }
    },
    setFile: async (id, _slotType, source) => {
      await attachment.setFile(companies, id, 'logoFile', source)
    },
    clearFile: async (id) => {
      await attachment.clearFile(companies, id, 'logoFile')
    },
    searchImages: (providerId, lookup) =>
      ipcManager.invoke('scraper:get-company-provider-images', providerId, lookup, 'logos')
  }
}
