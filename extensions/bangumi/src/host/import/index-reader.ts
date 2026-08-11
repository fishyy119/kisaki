import type { BangumiClient } from '../api/client'
import { collectPages } from '../api/pagination'
import type { BangumiIndex, BangumiIndexSubject } from '../api/types'
import { getBangumiSubjectType, type BangumiMediaScope } from '../../shared/scopes'
import { m } from '../i18n'

export interface IndexReaderOptions {
  indexId: number
  scope: BangumiMediaScope
  event: { signal: AbortSignal }
  report?: (phase: string, message: string) => void
}

export class IndexReader {
  constructor(private readonly client: BangumiClient) {}

  readIndex(indexId: number, event: { signal: AbortSignal }): Promise<BangumiIndex> {
    return this.client.getIndex(indexId, { signal: event.signal })
  }

  async readIndexSubjects(options: IndexReaderOptions): Promise<readonly BangumiIndexSubject[]> {
    options.report?.('loadingIndexSubjects', m().jobs.import.readingIndex)

    const subjects = await collectPages(
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
    const subjectType = getBangumiSubjectType(options.scope)
    return subjects.filter((subject) => subject.type === subjectType)
  }
}
