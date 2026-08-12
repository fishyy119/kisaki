import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { IngestService } from './service'

export function registerIngestIpc(service: IngestService, ipc: IpcService): void {
  ipc.handle('ingest:add-game-direct', async (_, seed, options) =>
    wrapIpc(() => service.add.game.startAddDirect(seed, options))
  )

  ipc.handle('ingest:add-game-from-scraper', async (_, profileId, lookup, options) =>
    wrapIpc(() => service.add.game.startAddFromScraper(profileId, lookup, options))
  )

  ipc.handle('ingest:add-anime-direct', async (_, seed, options) =>
    wrapIpc(() => service.add.anime.startAddDirect(seed, options))
  )

  ipc.handle('ingest:add-anime-from-scraper', async (_, profileId, lookup, options) =>
    wrapIpc(() => service.add.anime.startAddFromScraper(profileId, lookup, options))
  )

  ipc.handle('ingest:sync-anime-files', async (_, params) =>
    wrapIpc(() => service.files.anime.sync(params))
  )

  ipc.handle('ingest:attach-anime-episode-file', async (_, params) =>
    wrapIpcVoid(() => service.files.anime.attachFile(params))
  )

  ipc.handle('ingest:attach-anime-extra-file', async (_, params) =>
    wrapIpcVoid(() => service.files.anime.attachExtra(params))
  )

  ipc.handle('ingest:add-person-from-scraper', async (_, profileId, lookup, options) =>
    wrapIpc(() => service.add.person.startAddFromScraper(profileId, lookup, options))
  )

  ipc.handle('ingest:add-company-from-scraper', async (_, profileId, lookup, options) =>
    wrapIpc(() => service.add.company.startAddFromScraper(profileId, lookup, options))
  )

  ipc.handle('ingest:add-character-from-scraper', async (_, profileId, lookup, options) =>
    wrapIpc(() => service.add.character.startAddFromScraper(profileId, lookup, options))
  )

  ipc.handle('ingest:update-game-from-scraper', async (_, request) =>
    wrapIpc(() => service.update.game.startUpdateFromScraper(request))
  )

  ipc.handle('ingest:update-anime-from-scraper', async (_, request) =>
    wrapIpc(() => service.update.anime.startUpdateFromScraper(request))
  )

  ipc.handle('ingest:update-person-from-scraper', async (_, request) =>
    wrapIpc(() => service.update.person.startUpdateFromScraper(request))
  )

  ipc.handle('ingest:update-company-from-scraper', async (_, request) =>
    wrapIpc(() => service.update.company.startUpdateFromScraper(request))
  )

  ipc.handle('ingest:update-character-from-scraper', async (_, request) =>
    wrapIpc(() => service.update.character.startUpdateFromScraper(request))
  )

  ipc.handle('ingest:batch-update-game-from-scraper', async (_, request) =>
    wrapIpc(() => service.batch.game.startUpdateFromScraper(request))
  )

  ipc.handle('ingest:batch-update-anime-from-scraper', async (_, request) =>
    wrapIpc(() => service.batch.anime.startUpdateFromScraper(request))
  )

  ipc.handle('ingest:batch-update-person-from-scraper', async (_, request) =>
    wrapIpc(() => service.batch.person.startUpdateFromScraper(request))
  )

  ipc.handle('ingest:batch-update-company-from-scraper', async (_, request) =>
    wrapIpc(() => service.batch.company.startUpdateFromScraper(request))
  )

  ipc.handle('ingest:batch-update-character-from-scraper', async (_, request) =>
    wrapIpc(() => service.batch.character.startUpdateFromScraper(request))
  )
}
