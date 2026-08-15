import {
  kisaki,
  LIBRARY_GAME_STATUSES,
  type LibraryGame,
  type LibraryGamePatch,
  type LibraryGameStatus
} from '@kisaki3/extension-sdk'
import { BangumiLocalMediaAdapter } from '../local/adapter'
import { parseBangumiSubjectDate } from '../format/dates'
import { BANGUMI_SUBJECT_TYPE_BY_SCOPE } from '../../../shared/scopes'
import { omitUndefined } from '../../utils/object'
import type {
  BangumiMediaDescriptor,
  LocalMediaAddFromScraperInput,
  LocalMediaAddResult,
  LocalMediaAdapter,
  LocalMediaListQuery
} from '../types'

export class GameLocalMediaAdapter extends BangumiLocalMediaAdapter<LibraryGameStatus> {
  readonly scope = 'game' as const
  readonly localMediaType = 'game' as const

  protected readonly entityType = 'game' as const
  protected readonly tagLinkKind = 'game-tag' as const
  protected readonly collectionLinkKind = 'collection-game' as const
  protected readonly statusValues = LIBRARY_GAME_STATUSES

  async addFromScraper(input: LocalMediaAddFromScraperInput): Promise<LocalMediaAddResult> {
    const result = await kisaki.ingest.game.add.fromScraper(
      input.profileId,
      omitUndefined({
        name: input.name,
        knownIds: [...input.knownIds],
        releaseDate: parseBangumiSubjectDate(input.facts?.date)
      })
    )

    return { localId: result.gameId, isNew: result.isNew }
  }

  protected async listEntities(query: LocalMediaListQuery): Promise<readonly LibraryGame[]> {
    return kisaki.library.games.list(query)
  }

  protected async getEntity(localId: string): Promise<LibraryGame | null> {
    return kisaki.library.games.get(localId)
  }

  protected async updateEntity(localId: string, patch: LibraryGamePatch): Promise<void> {
    await kisaki.library.games.update(localId, patch)
  }

  protected async createTagLink(localId: string, tagId: string): Promise<void> {
    await kisaki.library.links.create({
      kind: 'game-tag',
      from: { entityType: 'game', id: localId },
      to: { entityType: 'tag', id: tagId },
      metadata: { order: 0 }
    })
  }

  protected async createCollectionLink(collectionId: string, localId: string): Promise<void> {
    await kisaki.library.links.create({
      kind: 'collection-game',
      from: { entityType: 'collection', id: collectionId },
      to: { entityType: 'game', id: localId },
      metadata: { order: 0 }
    })
  }
}

export function createGameMediaDescriptor(adapter: LocalMediaAdapter): BangumiMediaDescriptor {
  return {
    scope: 'game',
    subjectType: BANGUMI_SUBJECT_TYPE_BY_SCOPE.game,
    localAdapter: adapter
  }
}
