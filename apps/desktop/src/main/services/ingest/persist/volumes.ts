/** Novel volume row persistence shared by the first-write and re-scrape flows. */

import { nanoid } from 'nanoid'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'
import { novelVolumeExternalIds, novelVolumes } from '@shared/db'
import type { NovelVolumeInfo } from '@shared/metadata'
import type { DbContext } from '@main/services/db'

/**
 * Attach external ids to a novel volume row.
 *
 * Conflicts are skipped rather than reassigned: an id already claimed by
 * another volume stays there, mirroring how entity external ids behave.
 */
export function insertNovelVolumeExternalIds(
  tx: DbContext,
  volumeId: string,
  externalIds: ExternalId[] | undefined,
  startOrder = 0
): void {
  for (const [index, extId] of normalizeExternalIds(externalIds).entries()) {
    tx.insert(novelVolumeExternalIds)
      .values({
        volumeId,
        source: extId.source,
        externalId: extId.id,
        orderInVolume: startOrder + index
      })
      .onConflictDoNothing()
      .run()
  }
}

/** Insert one scraped volume row together with its identity, returning its id. */
export function insertNovelVolumeRow(
  tx: DbContext,
  novelId: string,
  volume: NovelVolumeInfo,
  orderInNovel: number
): string {
  const volumeId = nanoid()
  tx.insert(novelVolumes)
    .values({
      id: volumeId,
      novelId,
      volumeNumber: volume.volumeNumber,
      name: volume.name,
      originalName: volume.originalName,
      releaseDate: volume.releaseDate,
      description: volume.description,
      orderInNovel
    })
    .run()

  insertNovelVolumeExternalIds(tx, volumeId, volume.externalIds)
  return volumeId
}
