import {
  kisaki,
  LIBRARY_ANIME_STATUSES,
  type LibraryAnime,
  type LibraryAnimePatch,
  type LibraryAnimeStatus
} from '@kisaki3/extension-sdk'
import { BangumiLocalMediaAdapter } from '../local/adapter'
import { BANGUMI_SUBJECT_TYPE_BY_SCOPE } from '../../../shared/scopes'
import type {
  BangumiMediaDescriptor,
  LocalEpisodeItem,
  LocalMediaAddFromScraperInput,
  LocalMediaAddResult,
  LocalMediaAdapter,
  LocalMediaListQuery
} from '../types'

export class AnimeLocalMediaAdapter extends BangumiLocalMediaAdapter<LibraryAnimeStatus> {
  readonly scope = 'anime' as const
  readonly localMediaType = 'anime' as const
  readonly supportsEpisodeSync = true

  protected readonly entityType = 'anime' as const
  protected readonly tagLinkKind = 'anime-tag' as const
  protected readonly collectionLinkKind = 'collection-anime' as const
  protected readonly statusValues = LIBRARY_ANIME_STATUSES

  async listEpisodes(localId: string): Promise<readonly LocalEpisodeItem[]> {
    const episodes = await kisaki.library.animes.episodes.list({ animeId: localId })

    return episodes.map((episode) => ({
      localId: episode.id,
      watched: Boolean(episode.watchedAt),
      externalIds: episode.externalIds.map((externalId) => ({
        source: externalId.source,
        id: externalId.id
      }))
    }))
  }

  async addFromScraper(input: LocalMediaAddFromScraperInput): Promise<LocalMediaAddResult> {
    const result = await kisaki.ingest.anime.add.fromScraper(input.profileId, {
      name: input.name,
      knownIds: [...input.knownIds]
    })

    return { localId: result.animeId, isNew: result.isNew }
  }

  protected async listEntities(query: LocalMediaListQuery): Promise<readonly LibraryAnime[]> {
    return kisaki.library.animes.list(query)
  }

  protected async getEntity(localId: string): Promise<LibraryAnime | null> {
    return kisaki.library.animes.get(localId)
  }

  protected async updateEntity(localId: string, patch: LibraryAnimePatch): Promise<void> {
    await kisaki.library.animes.update(localId, patch)
  }

  protected async createTagLink(localId: string, tagId: string): Promise<void> {
    await kisaki.library.links.create({
      kind: 'anime-tag',
      from: { entityType: 'anime', id: localId },
      to: { entityType: 'tag', id: tagId },
      metadata: { order: 0 }
    })
  }

  protected async createCollectionLink(collectionId: string, localId: string): Promise<void> {
    await kisaki.library.links.create({
      kind: 'collection-anime',
      from: { entityType: 'collection', id: collectionId },
      to: { entityType: 'anime', id: localId },
      metadata: { order: 0 }
    })
  }
}

export function createAnimeMediaDescriptor(adapter: LocalMediaAdapter): BangumiMediaDescriptor {
  return {
    scope: 'anime',
    subjectType: BANGUMI_SUBJECT_TYPE_BY_SCOPE.anime,
    localAdapter: adapter
  }
}
