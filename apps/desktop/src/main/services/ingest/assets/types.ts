import type { TableName } from '@shared/db/table-names'

/**
 * A media file that still has to be downloaded after its row was committed.
 *
 * Assets are deliberately deferred past the transaction: downloads are async
 * and must not hold a write transaction open.
 */
export interface PendingAssetTask {
  table: TableName
  rowId: string
  field: string
  url: string
}
