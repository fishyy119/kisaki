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
import { shouldOfferWatchCatchUp } from '@renderer/composables/use-anime-watch'
import { shouldOfferReadCatchUp as shouldOfferComicReadCatchUp } from '@renderer/composables/use-comic-read'
import { shouldOfferReadCatchUp as shouldOfferNovelReadCatchUp } from '@renderer/composables/use-novel-read'
import { db } from '@renderer/core/db'
import type { Messages } from '@shared/i18n'
import type { TableName } from '@shared/db/table-names'
import {
  MEDIA_STATUS_VALUES,
  animes,
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionComicLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionNovelLinks,
  collectionPersonLinks,
  comics,
  games,
  novels,
  type MediaStatus
} from '@shared/db'
import type { ContentEntityType, MediaType } from '@shared/common'

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
const AnimeWatchCatchUpDialog = defineAsyncComponent(() =>
  import('@renderer/components/shared/anime').then((mod) => mod.AnimeWatchCatchUpDialog)
)
const ComicFilesConfigFormDialog = defineAsyncComponent(() =>
  import('@renderer/components/shared/comic').then((mod) => mod.ComicFilesConfigFormDialog)
)
const ComicReadCatchUpDialog = defineAsyncComponent(() =>
  import('@renderer/components/shared/comic').then((mod) => mod.ComicReadCatchUpDialog)
)
const NovelFilesConfigFormDialog = defineAsyncComponent(() =>
  import('@renderer/components/shared/novel').then((mod) => mod.NovelFilesConfigFormDialog)
)
const NovelReadCatchUpDialog = defineAsyncComponent(() =>
  import('@renderer/components/shared/novel').then((mod) => mod.NovelReadCatchUpDialog)
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

/**
 * Prompt a media type offers after its status was written, for statuses that
 * imply something about the entry's consumption units. The dialog is hosted by
 * the shared dialog assembly so it survives the menu closing.
 */
interface MenuStatusFollowUp {
  component: Component
  buildProps: (entityId: string) => Record<string, unknown>
  shouldOffer: (entityId: string, status: MediaStatus) => Promise<boolean>
}

/** Media-only menu extensions. */
export interface MenuStatusSection {
  label: (m: Messages) => string
  options: (m: Messages) => { value: MediaStatus; label: string }[]
  read: (entityId: string) => Promise<MediaStatus | null>
  write: (entityId: string, status: MediaStatus) => Promise<void>
  followUp?: MenuStatusFollowUp
}

/** Status options for one media type, labeled from the given catalog. */
function buildStatusOptions(
  m: Messages,
  mediaType: MediaType
): { value: MediaStatus; label: string }[] {
  return MEDIA_STATUS_VALUES.map((value) => ({
    value,
    label: m.library.status.values[mediaType][value]
  }))
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

export const MENU_SPECS: Record<ContentEntityType, MenuSpec> = {
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
      label: (m) => m.library.status.label.game,
      options: (m) => buildStatusOptions(m, 'game'),
      read: async (entityId) => {
        const rows = await db
          .select({ status: games.status })
          .from(games)
          .where(eq(games.id, entityId))
          .limit(1)
        return rows[0]?.status ?? null
      },
      write: async (entityId, status) => {
        await db.update(games).set({ status }).where(eq(games.id, entityId))
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
      label: (m) => m.library.status.label.anime,
      options: (m) => buildStatusOptions(m, 'anime'),
      read: async (entityId) => {
        const rows = await db
          .select({ status: animes.status })
          .from(animes)
          .where(eq(animes.id, entityId))
          .limit(1)
        return rows[0]?.status ?? null
      },
      write: async (entityId, status) => {
        await db.update(animes).set({ status }).where(eq(animes.id, entityId))
      },
      followUp: {
        component: AnimeWatchCatchUpDialog,
        buildProps: (entityId) => ({ animeId: entityId }),
        shouldOffer: (entityId, status) => shouldOfferWatchCatchUp(entityId, status)
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
  comic: {
    entityTable: 'comics',
    collections: {
      table: 'collection_comic_links',
      linkedCollectionIds: async (entityId) => {
        const links = await db.query.collectionComicLinks.findMany({
          where: eq(collectionComicLinks.comicId, entityId)
        })
        return new Set(links.map((link) => link.collectionId))
      },
      add: async (entityId, collectionId) => {
        await db.insert(collectionComicLinks).values({ collectionId, comicId: entityId })
      },
      remove: async (entityId, collectionId) => {
        await db
          .delete(collectionComicLinks)
          .where(
            and(
              eq(collectionComicLinks.comicId, entityId),
              eq(collectionComicLinks.collectionId, collectionId)
            )
          )
      },
      linkedPairs: (entityIds) =>
        db
          .select({
            collectionId: collectionComicLinks.collectionId,
            entityId: collectionComicLinks.comicId
          })
          .from(collectionComicLinks)
          .where(inArray(collectionComicLinks.comicId, entityIds)),
      addMany: async (entityIds, collectionId) => {
        await db
          .insert(collectionComicLinks)
          .values(entityIds.map((comicId) => ({ collectionId, comicId })))
      },
      removeMany: async (entityIds, collectionId) => {
        await db
          .delete(collectionComicLinks)
          .where(
            and(
              eq(collectionComicLinks.collectionId, collectionId),
              inArray(collectionComicLinks.comicId, entityIds)
            )
          )
      }
    },
    status: {
      label: (m) => m.library.status.label.comic,
      options: (m) => buildStatusOptions(m, 'comic'),
      read: async (entityId) => {
        const rows = await db
          .select({ status: comics.status })
          .from(comics)
          .where(eq(comics.id, entityId))
          .limit(1)
        return rows[0]?.status ?? null
      },
      write: async (entityId, status) => {
        await db.update(comics).set({ status }).where(eq(comics.id, entityId))
      },
      followUp: {
        component: ComicReadCatchUpDialog,
        buildProps: (entityId) => ({ comicId: entityId }),
        shouldOffer: (entityId, status) => shouldOfferComicReadCatchUp(entityId, status)
      }
    },
    dir: {
      label: (m) => m.comic.detail.openComicDir,
      path: async (entityId) => {
        const comic = await db.query.comics.findFirst({ where: eq(comics.id, entityId) })
        return comic?.comicDirPath ?? null
      }
    },
    extraDialogs: [
      {
        name: 'filesConfig',
        icon: 'icon-[mdi--folder-cog-outline]',
        label: (m) => m.comic.filesConfig.title,
        component: ComicFilesConfigFormDialog,
        buildProps: (entityId) => ({ comicId: entityId })
      }
    ]
  },
  novel: {
    entityTable: 'novels',
    collections: {
      table: 'collection_novel_links',
      linkedCollectionIds: async (entityId) => {
        const links = await db.query.collectionNovelLinks.findMany({
          where: eq(collectionNovelLinks.novelId, entityId)
        })
        return new Set(links.map((link) => link.collectionId))
      },
      add: async (entityId, collectionId) => {
        await db.insert(collectionNovelLinks).values({ collectionId, novelId: entityId })
      },
      remove: async (entityId, collectionId) => {
        await db
          .delete(collectionNovelLinks)
          .where(
            and(
              eq(collectionNovelLinks.novelId, entityId),
              eq(collectionNovelLinks.collectionId, collectionId)
            )
          )
      },
      linkedPairs: (entityIds) =>
        db
          .select({
            collectionId: collectionNovelLinks.collectionId,
            entityId: collectionNovelLinks.novelId
          })
          .from(collectionNovelLinks)
          .where(inArray(collectionNovelLinks.novelId, entityIds)),
      addMany: async (entityIds, collectionId) => {
        await db
          .insert(collectionNovelLinks)
          .values(entityIds.map((novelId) => ({ collectionId, novelId })))
      },
      removeMany: async (entityIds, collectionId) => {
        await db
          .delete(collectionNovelLinks)
          .where(
            and(
              eq(collectionNovelLinks.collectionId, collectionId),
              inArray(collectionNovelLinks.novelId, entityIds)
            )
          )
      }
    },
    status: {
      label: (m) => m.library.status.label.novel,
      options: (m) => buildStatusOptions(m, 'novel'),
      read: async (entityId) => {
        const rows = await db
          .select({ status: novels.status })
          .from(novels)
          .where(eq(novels.id, entityId))
          .limit(1)
        return rows[0]?.status ?? null
      },
      write: async (entityId, status) => {
        await db.update(novels).set({ status }).where(eq(novels.id, entityId))
      },
      followUp: {
        component: NovelReadCatchUpDialog,
        buildProps: (entityId) => ({ novelId: entityId }),
        shouldOffer: (entityId, status) => shouldOfferNovelReadCatchUp(entityId, status)
      }
    },
    dir: {
      label: (m) => m.novel.detail.openNovelDir,
      path: async (entityId) => {
        const novel = await db.query.novels.findFirst({ where: eq(novels.id, entityId) })
        return novel?.novelDirPath ?? null
      }
    },
    extraDialogs: [
      {
        name: 'filesConfig',
        icon: 'icon-[mdi--folder-cog-outline]',
        label: (m) => m.novel.filesConfig.title,
        component: NovelFilesConfigFormDialog,
        buildProps: (entityId) => ({ novelId: entityId })
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
