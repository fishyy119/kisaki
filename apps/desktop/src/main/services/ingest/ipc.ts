import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { IngestService } from './service'

export function registerIngestIpc(service: IngestService, ipc: IpcService): void {
  ipc.handle('ingest:add-game-direct', async (_, seed, options) =>
    wrapIpc(() => service.add.game.direct(seed, options))
  )

  ipc.handle('ingest:add-game-from-scraper', async (_, profileId, lookup, options) =>
    wrapIpc(() => service.add.game.fromScraper(profileId, lookup, options))
  )

  ipc.handle('ingest:add-person-from-scraper', async (_, profileId, lookup, options) =>
    wrapIpc(() => service.add.person.fromScraper(profileId, lookup, options))
  )

  ipc.handle('ingest:add-company-from-scraper', async (_, profileId, lookup, options) =>
    wrapIpc(() => service.add.company.fromScraper(profileId, lookup, options))
  )

  ipc.handle('ingest:add-character-from-scraper', async (_, profileId, lookup, options) =>
    wrapIpc(() => service.add.character.fromScraper(profileId, lookup, options))
  )

  ipc.handle('ingest:update-game-from-scraper', async (_, request) =>
    wrapIpcVoid(() => service.update.game.fromScraper(request))
  )

  ipc.handle('ingest:update-person-from-scraper', async (_, request) =>
    wrapIpcVoid(() => service.update.person.fromScraper(request))
  )

  ipc.handle('ingest:update-company-from-scraper', async (_, request) =>
    wrapIpcVoid(() => service.update.company.fromScraper(request))
  )

  ipc.handle('ingest:update-character-from-scraper', async (_, request) =>
    wrapIpcVoid(() => service.update.character.fromScraper(request))
  )
}
