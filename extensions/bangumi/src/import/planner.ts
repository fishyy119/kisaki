import type { BangumiMediaScope } from '../media/scopes'

export type PlannedImportAction =
  | {
      kind: 'create'
      scope: BangumiMediaScope
      subjectId: string
      name: string
      fields: readonly string[]
    }
  | {
      kind: 'patch'
      scope: BangumiMediaScope
      subjectId: string
      localId: string
      fields: readonly string[]
    }
  | { kind: 'skip'; scope: BangumiMediaScope; subjectId: string; reason: string }
  | { kind: 'unsupported'; scope: BangumiMediaScope; subjectId?: string; reason: string }
  | { kind: 'error'; scope: BangumiMediaScope; subjectId?: string; message: string }

export class ImportPlanner {
  createUnsupported(scope: BangumiMediaScope, reason: string): PlannedImportAction {
    return {
      kind: 'unsupported',
      scope,
      reason
    }
  }
}
