/**
 * Menu specs for the shared entity menu family.
 *
 * The shared menu items cover every entity's common actions (collections,
 * score, flags, assets, metadata, external ids, merge, delete). Media
 * entities extend the menu with a status radio group, an open-directory
 * action and extra dialog entries, all declared as spec data.
 */

import { and, eq, inArray } from 'drizzle-orm'
import { defineAsyncComponent, type Component } from 'vue'
import { db } from '@renderer/core/db'
import type { Messages } from '@shared/i18n'
import type { TableName } from '@shared/db/table-names'
import {
  ANIME_STATUS_VALUES,
  GAME_STATUS_VALUES,
  animes,
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionPersonLinks,
  games,
  type AnimeStatus,
  type GameStatus
} from '@shared/db'
import type { TableEntityType } from '../entity-tables'

/*
 * Media-specific dialog components load lazily: the entity domain must not
 * statically depend on the media entity domains it powers, or module
 * initialization would cycle through the entity barrels.
 */
const GameLaunchConfigFormDialog = defineAsyncComponent(() =>
  import('@renderer/components/shared/game').then((mod) => mod.GameLaunchConfigFormDialog)
)
const AnimeFilesConfigFormDialog = defineAsyncComponent(() =>
  import('@renderer/components/shared/anime').then((mod) => mod.AnimeFilesConfigFormDialog)
)

interface CollectionLinkStore {
  /** Link table name for db-change invalidation. */
  table: TableName
  linkedCollectionIds: (entityId: string) => Promise<Set<string>>
  add: (entityId: string, collectionId: string) => Promise<void>
  remove: (entityId: string, collectionId: string) => Promise<void>
  /** Batch variants over a selection of entity ids. */
  linkedPairs: (entityIds: string[]) => Promise<{ collectionId: string; entityId: string }[]>
  addMany: (entityIds: string[], collectionId: string) => Promise<void>
  removeMany: (entityIds: string[], collectionId: string) => Promise<void>
}

/** Media-only menu extensions. */
interface MenuStatusSection {
  label: (m: Messages) => string
  options: (m: Messages) => { value: string; label: string }[]
  read: (entityId: string) => Promise<string | null>
  write: (entityId: string, status: string) => Promise<void>
}

interface MenuDirSection {
  label: (m: Messages) => string
  /** Reads the openable directory path, or null when not configured. */
  path: (entityId: string) => Promise<string | null>
}

export interface MenuExtraDialog {
  /** Stable dialog id used by menu emits and shell dialog state. */
  name: string
  icon: string
  label: (m: Messages) => string
  component: Component
  buildProps: (entityId: string) => Record<string, unknown>
}

export interface MenuSpec {
  entityTable: TableName
  collections: CollectionLinkStore
  status?: MenuStatusSection
  dir?: MenuDirSection
  extraDialogs: MenuExtraDialog[]
}

export const MENU_SPECS: Record<TableEntityType, MenuSpec> = {
  game: {
    entityTable: 'games',
    collections: {
      table: 'collection_game_links',
      linkedCollectionIds: async (entityId) => {
        const links = await db.query.collectionGameLinks.findMany({
          where: eq(collectionGameLinks.gameId, entityId)
        })
        return new Set(links.map((link) => link.collectionId))
      },
      add: async (entityId, collectionId) => {
        await db.insert(collectionGameLinks).values({ collectionId, gameId: entityId })
      },
      remove: async (entityId, collectionId) => {
        await db
          .delete(collectionGameLinks)
          .where(
            and(
              eq(collectionGameLinks.gameId, entityId),
              eq(collectionGameLinks.collectionId, collectionId)
            )
          )
      },
      linkedPairs: (entityIds) =>
        db
          .select({
            collectionId: collectionGameLinks.collectionId,
            entityId: collectionGameLinks.gameId
          })
          .from(collectionGameLinks)
          .where(inArray(collectionGameLinks.gameId, entityIds)),
      addMany: async (entityIds, collectionId) => {
        await db
          .insert(collectionGameLinks)
          .values(entityIds.map((gameId) => ({ collectionId, gameId })))
      },
      removeMany: async (entityIds, collectionId) => {
        await db
          .delete(collectionGameLinks)
          .where(
            and(
              eq(collectionGameLinks.collectionId, collectionId),
              inArray(collectionGameLinks.gameId, entityIds)
            )
          )
      }
    },
    status: {
      label: (m) => m.library.menu.playStatus,
      options: (m) =>
        GAME_STATUS_VALUES.map((value) => ({ value, label: m.library.gameStatus[value] })),
      read: async (entityId) => {
        const rows = await db
          .select({ status: games.status })
          .from(games)
          .where(eq(games.id, entityId))
          .limit(1)
        return rows[0]?.status ?? null
      },
      write: async (entityId, status) => {
        await db
          .update(games)
          .set({ status: status as GameStatus })
          .where(eq(games.id, entityId))
      }
    },
    dir: {
      label: (m) => m.library.menu.openGameDir,
      path: async (entityId) => {
        const game = await db.query.games.findFirst({ where: eq(games.id, entityId) })
        if (!game) return null
        if (game.gameDirPath) return game.gameDirPath
        if (game.launcherMode === 'file' && game.launcherPath) return game.launcherPath
        return null
      }
    },
    extraDialogs: [
      {
        name: 'launchConfig',
        icon: 'icon-[mdi--power-settings-new]',
        label: (m) => m.library.menu.launchConfig,
        component: GameLaunchConfigFormDialog,
        buildProps: (entityId) => ({ gameId: entityId })
      }
    ]
  },
  anime: {
    entityTable: 'animes',
    collections: {
      table: 'collection_anime_links',
      linkedCollectionIds: async (entityId) => {
        const links = await db.query.collectionAnimeLinks.findMany({
          where: eq(collectionAnimeLinks.animeId, entityId)
        })
        return new Set(links.map((link) => link.collectionId))
      },
      add: async (entityId, collectionId) => {
        await db.insert(collectionAnimeLinks).values({ collectionId, animeId: entityId })
      },
      remove: async (entityId, collectionId) => {
        await db
          .delete(collectionAnimeLinks)
          .where(
            and(
              eq(collectionAnimeLinks.animeId, entityId),
              eq(collectionAnimeLinks.collectionId, collectionId)
            )
          )
      },
      linkedPairs: (entityIds) =>
        db
          .select({
            collectionId: collectionAnimeLinks.collectionId,
            entityId: collectionAnimeLinks.animeId
          })
          .from(collectionAnimeLinks)
          .where(inArray(collectionAnimeLinks.animeId, entityIds)),
      addMany: async (entityIds, collectionId) => {
        await db
          .insert(collectionAnimeLinks)
          .values(entityIds.map((animeId) => ({ collectionId, animeId })))
      },
      removeMany: async (entityIds, collectionId) => {
        await db
          .delete(collectionAnimeLinks)
          .where(
            and(
              eq(collectionAnimeLinks.collectionId, collectionId),
              inArray(collectionAnimeLinks.animeId, entityIds)
            )
          )
      }
    },
    status: {
      label: (m) => m.anime.detail.watchStatus,
      options: (m) =>
        ANIME_STATUS_VALUES.map((value) => ({ value, label: m.library.animeStatus[value] })),
      read: async (entityId) => {
        const rows = await db
          .select({ status: animes.status })
          .from(animes)
          .where(eq(animes.id, entityId))
          .limit(1)
        return rows[0]?.status ?? null
      },
      write: async (entityId, status) => {
        await db
          .update(animes)
          .set({ status: status as AnimeStatus })
          .where(eq(animes.id, entityId))
      }
    },
    dir: {
      label: (m) => m.anime.detail.openAnimeDir,
      path: async (entityId) => {
        const anime = await db.query.animes.findFirst({ where: eq(animes.id, entityId) })
        return anime?.animeDirPath ?? null
      }
    },
    extraDialogs: [
      {
        name: 'filesConfig',
        icon: 'icon-[mdi--folder-cog-outline]',
        label: (m) => m.anime.filesConfig.title,
        component: AnimeFilesConfigFormDialog,
        buildProps: (entityId) => ({ animeId: entityId })
      }
    ]
  },
  character: {
    entityTable: 'characters',
    collections: {
      table: 'collection_character_links',
      linkedCollectionIds: async (entityId) => {
        const links = await db.query.collectionCharacterLinks.findMany({
          where: eq(collectionCharacterLinks.characterId, entityId)
        })
        return new Set(links.map((link) => link.collectionId))
      },
      add: async (entityId, collectionId) => {
        await db.insert(collectionCharacterLinks).values({ collectionId, characterId: entityId })
      },
      remove: async (entityId, collectionId) => {
        await db
          .delete(collectionCharacterLinks)
          .where(
            and(
              eq(collectionCharacterLinks.characterId, entityId),
              eq(collectionCharacterLinks.collectionId, collectionId)
            )
          )
      },
      linkedPairs: (entityIds) =>
        db
          .select({
            collectionId: collectionCharacterLinks.collectionId,
            entityId: collectionCharacterLinks.characterId
          })
          .from(collectionCharacterLinks)
          .where(inArray(collectionCharacterLinks.characterId, entityIds)),
      addMany: async (entityIds, collectionId) => {
        await db
          .insert(collectionCharacterLinks)
          .values(entityIds.map((characterId) => ({ collectionId, characterId })))
      },
      removeMany: async (entityIds, collectionId) => {
        await db
          .delete(collectionCharacterLinks)
          .where(
            and(
              eq(collectionCharacterLinks.collectionId, collectionId),
              inArray(collectionCharacterLinks.characterId, entityIds)
            )
          )
      }
    },
    extraDialogs: []
  },
  person: {
    entityTable: 'persons',
    collections: {
      table: 'collection_person_links',
      linkedCollectionIds: async (entityId) => {
        const links = await db.query.collectionPersonLinks.findMany({
          where: eq(collectionPersonLinks.personId, entityId)
        })
        return new Set(links.map((link) => link.collectionId))
      },
      add: async (entityId, collectionId) => {
        await db.insert(collectionPersonLinks).values({ collectionId, personId: entityId })
      },
      remove: async (entityId, collectionId) => {
        await db
          .delete(collectionPersonLinks)
          .where(
            and(
              eq(collectionPersonLinks.personId, entityId),
              eq(collectionPersonLinks.collectionId, collectionId)
            )
          )
      },
      linkedPairs: (entityIds) =>
        db
          .select({
            collectionId: collectionPersonLinks.collectionId,
            entityId: collectionPersonLinks.personId
          })
          .from(collectionPersonLinks)
          .where(inArray(collectionPersonLinks.personId, entityIds)),
      addMany: async (entityIds, collectionId) => {
        await db
          .insert(collectionPersonLinks)
          .values(entityIds.map((personId) => ({ collectionId, personId })))
      },
      removeMany: async (entityIds, collectionId) => {
        await db
          .delete(collectionPersonLinks)
          .where(
            and(
              eq(collectionPersonLinks.collectionId, collectionId),
              inArray(collectionPersonLinks.personId, entityIds)
            )
          )
      }
    },
    extraDialogs: []
  },
  company: {
    entityTable: 'companies',
    collections: {
      table: 'collection_company_links',
      linkedCollectionIds: async (entityId) => {
        const links = await db.query.collectionCompanyLinks.findMany({
          where: eq(collectionCompanyLinks.companyId, entityId)
        })
        return new Set(links.map((link) => link.collectionId))
      },
      add: async (entityId, collectionId) => {
        await db.insert(collectionCompanyLinks).values({ collectionId, companyId: entityId })
      },
      remove: async (entityId, collectionId) => {
        await db
          .delete(collectionCompanyLinks)
          .where(
            and(
              eq(collectionCompanyLinks.companyId, entityId),
              eq(collectionCompanyLinks.collectionId, collectionId)
            )
          )
      },
      linkedPairs: (entityIds) =>
        db
          .select({
            collectionId: collectionCompanyLinks.collectionId,
            entityId: collectionCompanyLinks.companyId
          })
          .from(collectionCompanyLinks)
          .where(inArray(collectionCompanyLinks.companyId, entityIds)),
      addMany: async (entityIds, collectionId) => {
        await db
          .insert(collectionCompanyLinks)
          .values(entityIds.map((companyId) => ({ collectionId, companyId })))
      },
      removeMany: async (entityIds, collectionId) => {
        await db
          .delete(collectionCompanyLinks)
          .where(
            and(
              eq(collectionCompanyLinks.collectionId, collectionId),
              inArray(collectionCompanyLinks.companyId, entityIds)
            )
          )
      }
    },
    extraDialogs: []
  }
}
