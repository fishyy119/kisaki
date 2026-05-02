/**
 * Scraper Service
 *
 * Lightweight service for scraper providers and profile-based metadata fetching.
 * Database CRUD is handled directly via Drizzle in both processes.
 *
 * Responsibilities:
 * - Provider registration (builtin + extensions)
 * - Profile-based scraping operations via IPC
 */

import log from 'electron-log/main'
import { asc, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { IContentService, ServiceInitContainer, ServiceName } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import type { ContentEntityType } from '@shared/common'
import * as schema from '@shared/db'
import { scraperProfiles, type ScraperProfile } from '@shared/db'
import type { ScraperProfileListQuery, ScraperProfileSummary } from '@shared/scraper'
import { createScraperProviderDeps } from './deps'
import type { ScraperProviderDeps } from './types'
import { GameScraperHandler } from './handlers/game'
import type { GameScraperProvider } from './handlers/game'
import { PersonScraperHandler } from './handlers/person'
import type { PersonScraperProvider } from './handlers/person'
import { CompanyScraperHandler } from './handlers/company'
import type { CompanyScraperProvider } from './handlers/company'
import { CharacterScraperHandler } from './handlers/character'
import type { CharacterScraperProvider } from './handlers/character'
import { IGDBProvider } from './handlers/game/providers/igdb'
import { VNDBProvider } from './handlers/game/providers/vndb'
import { YmgalProvider } from './handlers/game/providers/ymgal'

export class ScraperService implements IContentService {
  readonly id = 'scraper'
  readonly deps = ['db', 'i18n', 'ipc', 'network'] as const satisfies readonly ServiceName[]

  game!: GameScraperHandler
  person!: PersonScraperHandler
  company!: CompanyScraperHandler
  character!: CharacterScraperHandler

  private ipcService!: IpcService
  private db!: BetterSQLite3Database<typeof schema>

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    this.db = dbService.db
    const i18n = container.get('i18n')
    this.ipcService = container.get('ipc')
    const providerDeps = createScraperProviderDeps({
      network: container.get('network'),
      log
    })

    this.game = new GameScraperHandler(dbService.db, i18n)
    this.person = new PersonScraperHandler(dbService.db, i18n)
    this.company = new CompanyScraperHandler(dbService.db, i18n)
    this.character = new CharacterScraperHandler(dbService.db, i18n)
    this.registerBuiltinProviders(providerDeps)
    this.setupIpcHandlers()

    log.info('[ScraperService] Initialized')
  }

  private registerBuiltinProviders(deps: ScraperProviderDeps): void {
    this.game.registerProvider(new YmgalProvider(deps))
    this.game.registerProvider(new IGDBProvider(deps))
    this.game.registerProvider(new VNDBProvider(deps))
  }

  private setupIpcHandlers(): void {
    const ipc = this.ipcService

    // =========================================================================
    // Profile Info
    // =========================================================================

    ipc.handle('scraper:list-profiles', async (_, query) => {
      try {
        return { success: true as const, data: this.listProfiles(query) }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:get-profile', async (_, profileId) => {
      try {
        return { success: true as const, data: this.getProfile(profileId) }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    // =========================================================================
    // Provider Info
    // =========================================================================

    ipc.handle('scraper:list-game-providers', async () => {
      try {
        return { success: true as const, data: this.game.getProviders() }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:get-game-provider', async (_, providerId) => {
      try {
        return { success: true as const, data: this.game.getProviderInfo(providerId) }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:list-person-providers', async () => {
      try {
        return { success: true as const, data: this.person.getProviders() }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:get-person-provider', async (_, providerId) => {
      try {
        return { success: true as const, data: this.person.getProviderInfo(providerId) }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:list-company-providers', async () => {
      try {
        return { success: true as const, data: this.company.getProviders() }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:get-company-provider', async (_, providerId) => {
      try {
        return { success: true as const, data: this.company.getProviderInfo(providerId) }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:list-character-providers', async () => {
      try {
        return { success: true as const, data: this.character.getProviders() }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:get-character-provider', async (_, providerId) => {
      try {
        return { success: true as const, data: this.character.getProviderInfo(providerId) }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    // =========================================================================
    // Profile-Based Game Operations
    // =========================================================================

    ipc.handle('scraper:search-game', async (_, profileId, query) => {
      try {
        return { success: true as const, data: await this.game.search(profileId, query) }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:scrape-game', async (_, profileId, lookup) => {
      try {
        return {
          success: true as const,
          data: await this.game.scrape(profileId, lookup)
        }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:get-game-provider-images', async (_, providerId, lookup, imageType) => {
      try {
        return {
          success: true as const,
          data: await this.game.getProviderImages(providerId, lookup, imageType)
        }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    // =========================================================================
    // Profile-Based Metadata Entity Operations
    // =========================================================================

    ipc.handle('scraper:search-person', async (_, profileId, query) => {
      try {
        return { success: true as const, data: await this.person.search(profileId, query) }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:scrape-person', async (_, profileId, lookup) => {
      try {
        return {
          success: true as const,
          data: await this.person.scrape(profileId, lookup)
        }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:get-person-provider-images', async (_, providerId, lookup, imageType) => {
      try {
        return {
          success: true as const,
          data: await this.person.getProviderImages(providerId, lookup, imageType)
        }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:search-company', async (_, profileId, query) => {
      try {
        return { success: true as const, data: await this.company.search(profileId, query) }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:scrape-company', async (_, profileId, lookup) => {
      try {
        return {
          success: true as const,
          data: await this.company.scrape(profileId, lookup)
        }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:get-company-provider-images', async (_, providerId, lookup, imageType) => {
      try {
        return {
          success: true as const,
          data: await this.company.getProviderImages(providerId, lookup, imageType)
        }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:search-character', async (_, profileId, query) => {
      try {
        return { success: true as const, data: await this.character.search(profileId, query) }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle('scraper:scrape-character', async (_, profileId, lookup) => {
      try {
        return {
          success: true as const,
          data: await this.character.scrape(profileId, lookup)
        }
      } catch (error) {
        return { success: false as const, error: (error as Error).message }
      }
    })

    ipc.handle(
      'scraper:get-character-provider-images',
      async (_, providerId, lookup, imageType) => {
        try {
          return {
            success: true as const,
            data: await this.character.getProviderImages(providerId, lookup, imageType)
          }
        } catch (error) {
          return { success: false as const, error: (error as Error).message }
        }
      }
    )
  }

  getSupportedContent(): ContentEntityType[] {
    return ['game', 'character', 'person', 'company']
  }

  listProfiles(query: ScraperProfileListQuery = {}): ScraperProfileSummary[] {
    const rows = this.db
      .select()
      .from(scraperProfiles)
      .orderBy(asc(scraperProfiles.order), asc(scraperProfiles.name))
      .all()
    const filtered = query.mediaType
      ? rows.filter((profile) => profile.mediaType === query.mediaType)
      : rows

    return filtered.map((profile) => toScraperProfileSummary(profile))
  }

  getProfile(profileId: string): ScraperProfileSummary | null {
    const profile =
      this.db
        .select()
        .from(scraperProfiles)
        .where(eq(scraperProfiles.id, profileId))
        .limit(1)
        .get() ?? null

    return profile ? toScraperProfileSummary(profile) : null
  }

  // ===========================================================================
  // Provider management for built-in and extension providers.
  // ===========================================================================

  registerGameProvider(provider: GameScraperProvider): void {
    this.game.registerProvider(provider)
  }

  async unregisterGameProvider(providerId: string): Promise<void> {
    this.game.unregisterProvider(providerId)
  }

  registerPersonProvider(provider: PersonScraperProvider): void {
    this.person.registerProvider(provider)
  }

  async unregisterPersonProvider(providerId: string): Promise<void> {
    this.person.unregisterProvider(providerId)
  }

  registerCompanyProvider(provider: CompanyScraperProvider): void {
    this.company.registerProvider(provider)
  }

  async unregisterCompanyProvider(providerId: string): Promise<void> {
    this.company.unregisterProvider(providerId)
  }

  registerCharacterProvider(provider: CharacterScraperProvider): void {
    this.character.registerProvider(provider)
  }

  async unregisterCharacterProvider(providerId: string): Promise<void> {
    this.character.unregisterProvider(providerId)
  }
}

function toScraperProfileSummary(profile: ScraperProfile): ScraperProfileSummary {
  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    mediaType: profile.mediaType,
    searchProviderId: profile.searchProviderId,
    defaultLocale: profile.defaultLocale,
    providerSlots: Object.entries(profile.slotConfigs).map(([slot, config]) => ({
      slot,
      providerIds: config.providers
        .filter((provider) => provider.enabled)
        .sort((left, right) => left.priority - right.priority)
        .map((provider) => provider.providerId)
    }))
  }
}
