import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { IngestWarning } from '@shared/ingest'
import type { PendingAssetTask } from './types'

const log = createLogger('Ingest')

/**
 * Downloads deferred assets for rows that are already committed.
 *
 * Runs past the commit point, so it never aborts: the signal is still passed on
 * to save bandwidth, but a cancelled download is reported as a warning and the
 * operation finishes rather than claiming the whole ingest was cancelled.
 */
export async function flushPendingAssets(
  dbService: DbService,
  pendingAssets: PendingAssetTask[],
  options?: { signal?: AbortSignal }
): Promise<IngestWarning[]> {
  const warningResults = await Promise.all(
    pendingAssets.map(async (asset): Promise<IngestWarning | undefined> => {
      try {
        await dbService.attachment.setFileByTableName(
          asset.table,
          asset.rowId,
          asset.field,
          { kind: 'url', url: asset.url },
          options?.signal
        )
        return undefined
      } catch (error) {
        const message = `Asset persistence failed for ${describePendingAsset(asset)}.`
        log.warn('Asset flush warning.', error, { message: message })
        return { code: 'asset-persist-failed', message }
      }
    })
  )

  return warningResults.filter((warning): warning is IngestWarning => warning !== undefined)
}

function describePendingAsset(asset: PendingAssetTask): string {
  return `${asset.table} ${asset.rowId} (${asset.field})`
}
