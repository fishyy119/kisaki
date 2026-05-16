import type { IpcService } from '@main/services/ipc'
import { wrapIpc } from '@main/services/ipc'
import type { ScraperService } from './service'

export function registerScraperIpc(service: ScraperService, ipc: IpcService): void {
  ipc.handle('scraper:list-profiles', async (_, query) =>
    wrapIpc(() => service.profiles.list(query))
  )

  ipc.handle('scraper:get-profile', async (_, profileId) =>
    wrapIpc(() => service.profiles.get(profileId))
  )

  ipc.handle('scraper:list-game-providers', async () => wrapIpc(() => service.game.getProviders()))

  ipc.handle('scraper:get-game-provider', async (_, providerId) =>
    wrapIpc(() => service.game.getProviderInfo(providerId))
  )

  ipc.handle('scraper:list-person-providers', async () =>
    wrapIpc(() => service.person.getProviders())
  )

  ipc.handle('scraper:get-person-provider', async (_, providerId) =>
    wrapIpc(() => service.person.getProviderInfo(providerId))
  )

  ipc.handle('scraper:list-company-providers', async () =>
    wrapIpc(() => service.company.getProviders())
  )

  ipc.handle('scraper:get-company-provider', async (_, providerId) =>
    wrapIpc(() => service.company.getProviderInfo(providerId))
  )

  ipc.handle('scraper:list-character-providers', async () =>
    wrapIpc(() => service.character.getProviders())
  )

  ipc.handle('scraper:get-character-provider', async (_, providerId) =>
    wrapIpc(() => service.character.getProviderInfo(providerId))
  )

  ipc.handle('scraper:search-game', async (_, profileId, query) =>
    wrapIpc(() => service.game.search(profileId, query))
  )

  ipc.handle('scraper:scrape-game', async (_, profileId, lookup) =>
    wrapIpc(() => service.game.scrape(profileId, lookup))
  )

  ipc.handle('scraper:get-game-provider-images', async (_, providerId, lookup, imageType) =>
    wrapIpc(() => service.game.getProviderImages(providerId, lookup, imageType))
  )

  ipc.handle('scraper:search-person', async (_, profileId, query) =>
    wrapIpc(() => service.person.search(profileId, query))
  )

  ipc.handle('scraper:scrape-person', async (_, profileId, lookup) =>
    wrapIpc(() => service.person.scrape(profileId, lookup))
  )

  ipc.handle('scraper:get-person-provider-images', async (_, providerId, lookup, imageType) =>
    wrapIpc(() => service.person.getProviderImages(providerId, lookup, imageType))
  )

  ipc.handle('scraper:search-company', async (_, profileId, query) =>
    wrapIpc(() => service.company.search(profileId, query))
  )

  ipc.handle('scraper:scrape-company', async (_, profileId, lookup) =>
    wrapIpc(() => service.company.scrape(profileId, lookup))
  )

  ipc.handle('scraper:get-company-provider-images', async (_, providerId, lookup, imageType) =>
    wrapIpc(() => service.company.getProviderImages(providerId, lookup, imageType))
  )

  ipc.handle('scraper:search-character', async (_, profileId, query) =>
    wrapIpc(() => service.character.search(profileId, query))
  )

  ipc.handle('scraper:scrape-character', async (_, profileId, lookup) =>
    wrapIpc(() => service.character.scrape(profileId, lookup))
  )

  ipc.handle('scraper:get-character-provider-images', async (_, providerId, lookup, imageType) =>
    wrapIpc(() => service.character.getProviderImages(providerId, lookup, imageType))
  )
}
