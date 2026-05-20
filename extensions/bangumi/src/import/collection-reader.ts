import type { CommandContributionExecuteEvent } from '@kisaki/extension-sdk'
import type { BangumiClient } from '../api/client'
import { collectPages } from '../api/pagination'
import type { BangumiCollectionType, BangumiUserCollection } from '../api/types'
import type { BangumiMediaScope } from '../media/scopes'
import { formatScopedCollectionType } from '../media/labels'
import { BangumiExtensionError } from '../shared/errors'

export interface CollectionReaderOptions {
  username: string
  scope: BangumiMediaScope
  collectionTypes: readonly BangumiCollectionType[]
  event: CommandContributionExecuteEvent
  report?: (phase: string, message: string) => void
}

export class CollectionReader {
  constructor(private readonly client: BangumiClient) {}

  async readUserCollections(
    options: CollectionReaderOptions
  ): Promise<readonly BangumiUserCollection[]> {
    const collections: BangumiUserCollection[] = []

    for (const collectionType of options.collectionTypes) {
      assertNotCancelled(options.event.signal)
      options.report?.(
        'loadingCollections',
        `正在读取 Bangumi ${formatScopedCollectionType(options.scope, collectionType)}收藏...`
      )

      collections.push(
        ...(await collectPages(
          (query) =>
            this.client.getUserCollections(
              options.username,
              {
                ...query,
                scope: options.scope,
                type: collectionType
              },
              { signal: options.event.signal }
            ),
          { limit: 50 }
        ))
      )
    }

    return collections
  }
}

function assertNotCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new BangumiExtensionError('job_cancelled', 'Bangumi job 已取消。')
  }
}
