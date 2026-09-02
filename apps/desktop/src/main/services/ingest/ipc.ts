import type { IpcService } from '@main/services/ipc'
import { wrapIpc } from '@main/services/ipc'
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

  ipc.handle('ingest:add-comic-direct', async (_, seed, options) =>
    wrapIpc(() => service.add.comic.startAddDirect(seed, options))
  )

  ipc.handle('ingest:add-comic-from-scraper', async (_, profileId, lookup, options) =>
    wrapIpc(() => service.add.comic.startAddFromScraper(profileId, lookup, options))
  )

  ipc.handle('ingest:add-novel-direct', async (_, seed, options) =>
    wrapIpc(() => service.add.novel.startAddDirect(seed, options))
  )

  ipc.handle('ingest:add-novel-from-scraper', async (_, profileId, lookup, options) =>
    wrapIpc(() => service.add.novel.startAddFromScraper(profileId, lookup, options))
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

  ipc.handle('ingest:update-comic-from-scraper', async (_, request) =>
    wrapIpc(() => service.update.comic.startUpdateFromScraper(request))
  )

  ipc.handle('ingest:update-novel-from-scraper', async (_, request) =>
    wrapIpc(() => service.update.novel.startUpdateFromScraper(request))
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
    wrapIpc(() => service.batch.start('game', request))
  )

  ipc.handle('ingest:batch-update-anime-from-scraper', async (_, request) =>
    wrapIpc(() => service.batch.start('anime', request))
  )

  ipc.handle('ingest:batch-update-comic-from-scraper', async (_, request) =>
    wrapIpc(() => service.batch.start('comic', request))
  )

  ipc.handle('ingest:batch-update-novel-from-scraper', async (_, request) =>
    wrapIpc(() => service.batch.start('novel', request))
  )

  ipc.handle('ingest:batch-update-person-from-scraper', async (_, request) =>
    wrapIpc(() => service.batch.start('person', request))
  )

  ipc.handle('ingest:batch-update-company-from-scraper', async (_, request) =>
    wrapIpc(() => service.batch.start('company', request))
  )

  ipc.handle('ingest:batch-update-character-from-scraper', async (_, request) =>
    wrapIpc(() => service.batch.start('character', request))
  )
}
