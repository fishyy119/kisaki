import type { BangumiClient } from '../api/client'
import { collectPages } from '../api/pagination'
import type { BangumiCollectionType, BangumiUserCollection } from '../api/types'
import type { BangumiMediaScope } from '../media/scopes'
import { BangumiExtensionError } from '../utils/errors'
import { m } from '../i18n'

export interface CollectionReaderOptions {
  username: string
  scope: BangumiMediaScope
  collectionTypes: readonly BangumiCollectionType[]
  event: { signal: AbortSignal }
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
        m().jobs.import.readingCollections({ scope: options.scope, type: collectionType })
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
    throw new BangumiExtensionError('job_cancelled', m().errors.jobCancelled)
  }
}
