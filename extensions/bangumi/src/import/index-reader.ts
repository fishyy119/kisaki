import type { CommandContributionExecuteEvent } from '@kisaki/extension-sdk'
import type { BangumiClient } from '../api/client'
import { collectPages } from '../api/pagination'
import type { BangumiIndex, BangumiIndexSubject } from '../api/types'
import type { BangumiMediaScope } from '../media/scopes'

export interface IndexReaderOptions {
  indexId: number
  scope: BangumiMediaScope
  event: CommandContributionExecuteEvent
  report?: (phase: string, message: string) => void
}

export class IndexReader {
  constructor(private readonly client: BangumiClient) {}

  readIndex(indexId: number, event: CommandContributionExecuteEvent): Promise<BangumiIndex> {
    return this.client.getIndex(indexId, { signal: event.signal })
  }

  async readIndexSubjects(options: IndexReaderOptions): Promise<readonly BangumiIndexSubject[]> {
    options.report?.('loadingIndexSubjects', '正在读取 Bangumi 目录条目...')

    return collectPages(
      (query) =>
        this.client.getIndexSubjects(
          options.indexId,
          {
            ...query,
            scope: options.scope
          },
          { signal: options.event.signal }
        ),
      { limit: 50 }
    )
  }
}
