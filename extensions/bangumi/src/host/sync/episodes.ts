/**
 * Episode-level sync.
 *
 * Watch state is pushed as set differences against the last confirmed remote
 * set, in one batched call per direction. The first run of an entry reconciles
 * against Bangumi so an existing remote history is adopted instead of resent.
 */

import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../api/client'
import { BangumiApiError } from '../api/errors'
import type { BangumiMediaScope } from '../../shared/scopes'
import type { BangumiSettingsStore } from '../config/schema'
import {
  createBangumiSubjectRef,
  readBangumiSubjectIdFromExternalIds
} from '../identity/subject-ref'
import type { LocalEpisodeItem } from '../media/types'
import type { MediaRegistry } from '../media/registry'
import { BANGUMI_SOURCE_ID } from '../utils/constants'
import type { EpisodeSyncStateStore } from './episode-state'

const EPISODE_COLLECTION_WATCHED = 2
const EPISODE_COLLECTION_NONE = 0

export type EpisodeSyncStatus =
  | 'synced'
  | 'skippedUnsupportedScope'
  | 'skippedLocalSyncDisabled'
  | 'skippedDisabled'
  | 'skippedMissingLocalItem'
  | 'skippedNoBangumiId'
  | 'skippedNoLinkedEpisodes'
  | 'skippedNoChange'

export interface EpisodeSyncResult {
  status: EpisodeSyncStatus
  scope: BangumiMediaScope
  localId: string
  subjectId?: string
  markedCount?: number
  unmarkedCount?: number
}

export interface EpisodeSyncOptions {
  scope: BangumiMediaScope
  localId: string
  signal?: AbortSignal | undefined
}

export interface EpisodeSyncEngineDependencies {
  settingsStore: BangumiSettingsStore
  client: BangumiClient
  mediaRegistry: MediaRegistry
  stateStore: EpisodeSyncStateStore
  logger?: ExtensionLogger
}

export class EpisodeSyncEngine {
  constructor(private readonly deps: EpisodeSyncEngineDependencies) {}

  async syncEpisodes(options: EpisodeSyncOptions): Promise<EpisodeSyncResult> {
    const { scope, localId } = options
    const adapter = this.deps.mediaRegistry.getLocalAdapter(scope)
    // Only scopes that can enumerate episodes reach the per-episode engine;
    // book scopes carry their progress on the collection payload instead.
    if (!adapter?.supportsUnitProgress || !adapter.listEpisodes) {
      return { status: 'skippedUnsupportedScope', scope, localId }
    }

    const settings = await this.deps.settingsStore.get()
    if (!settings.media[scope].localSyncEnabled) {
      return { status: 'skippedLocalSyncDisabled', scope, localId }
    }
    if (!settings.autoSync.unitProgressEnabled) {
      return { status: 'skippedDisabled', scope, localId }
    }

    const item = await adapter.getLocalItem(localId)
    if (!item) {
      return { status: 'skippedMissingLocalItem', scope, localId }
    }

    const subjectId = readBangumiSubjectIdFromExternalIds(item)
    if (!subjectId) {
      return { status: 'skippedNoBangumiId', scope, localId }
    }

    const episodes = await adapter.listEpisodes(localId)
    const known = readLinkedEpisodeIds(episodes)
    if (known.size === 0) {
      return { status: 'skippedNoLinkedEpisodes', scope, localId, subjectId }
    }

    const subjectRef = createBangumiSubjectRef(scope, subjectId)
    const watched = new Set(
      [...known].filter(([, episode]) => episode.watched).map(([episodeId]) => episodeId)
    )
    const previous = await this.readRemoteBaseline(options, subjectId, known)

    const toMark = [...watched].filter((episodeId) => !previous.has(episodeId))
    const toUnmark = [...previous].filter(
      (episodeId) => known.has(episodeId) && !watched.has(episodeId)
    )

    if (toMark.length === 0 && toUnmark.length === 0) {
      await this.deps.stateStore.record({
        scope,
        localId,
        subjectId,
        watchedEpisodeIds: [...watched],
        updatedAt: Date.now()
      })
      return { status: 'skippedNoChange', scope, localId, subjectId }
    }

    await this.deps.client.patchMyEpisodeCollections(
      subjectRef,
      toMark,
      EPISODE_COLLECTION_WATCHED,
      { signal: options.signal }
    )
    await this.deps.client.patchMyEpisodeCollections(
      subjectRef,
      toUnmark,
      EPISODE_COLLECTION_NONE,
      { signal: options.signal }
    )

    await this.deps.stateStore.record({
      scope,
      localId,
      subjectId,
      watchedEpisodeIds: [...watched],
      updatedAt: Date.now()
    })

    return {
      status: 'synced',
      scope,
      localId,
      subjectId,
      markedCount: toMark.length,
      unmarkedCount: toUnmark.length
    }
  }

  /**
   * Baseline of remotely watched episodes: the recorded set when this entry has
   * synced before, otherwise one reconciliation read against Bangumi.
   */
  private async readRemoteBaseline(
    options: EpisodeSyncOptions,
    subjectId: string,
    known: ReadonlyMap<number, LocalEpisodeItem>
  ): Promise<Set<number>> {
    const recorded = await this.deps.stateStore.get(options.scope, options.localId)
    if (recorded && recorded.subjectId === subjectId) {
      return new Set(recorded.watchedEpisodeIds)
    }

    try {
      const collections = await this.deps.client.getMyEpisodeCollections(
        createBangumiSubjectRef(options.scope, subjectId),
        { signal: options.signal }
      )
      return new Set(
        collections
          .filter((collection) => collection.type === EPISODE_COLLECTION_WATCHED)
          .map((collection) => collection.episode.id)
          .filter((episodeId) => known.has(episodeId))
      )
    } catch (error) {
      // No remote collection yet: every local watch is a new mark.
      if (error instanceof BangumiApiError && error.status === 404) {
        return new Set()
      }
      throw error
    }
  }
}

function readLinkedEpisodeIds(
  episodes: readonly LocalEpisodeItem[]
): ReadonlyMap<number, LocalEpisodeItem> {
  const linked = new Map<number, LocalEpisodeItem>()

  for (const episode of episodes) {
    const raw = episode.externalIds.find(
      (externalId) => externalId.source === BANGUMI_SOURCE_ID
    )?.id
    const episodeId = raw && /^\d+$/.test(raw.trim()) ? Number.parseInt(raw.trim(), 10) : 0
    if (episodeId > 0) {
      linked.set(episodeId, episode)
    }
  }

  return linked
}
