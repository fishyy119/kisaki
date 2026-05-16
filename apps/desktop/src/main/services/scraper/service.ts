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

import { createLogger } from '@main/log'
import { asc, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { IContentService, ServiceInitContainer, ServiceName } from '@main/container'
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
import { registerScraperIpc } from './ipc'

const log = createLogger('Scraper')

export class ScraperService implements IContentService {
  readonly id = 'scraper'
  readonly deps = ['db', 'i18n', 'ipc', 'network'] as const satisfies readonly ServiceName[]

  game!: GameScraperHandler
  person!: PersonScraperHandler
  company!: CompanyScraperHandler
  character!: CharacterScraperHandler

  private db!: BetterSQLite3Database<typeof schema>

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const dbService = container.get('db')
    this.db = dbService.client
    const i18n = container.get('i18n')
    const ipcService = container.get('ipc')
    const providerDeps = createScraperProviderDeps({
      network: container.get('network'),
      log
    })

    this.game = new GameScraperHandler(dbService.client, i18n)
    this.person = new PersonScraperHandler(dbService.client, i18n)
    this.company = new CompanyScraperHandler(dbService.client, i18n)
    this.character = new CharacterScraperHandler(dbService.client, i18n)
    this.registerBuiltinProviders(providerDeps)
    registerScraperIpc(this, ipcService)

    log.info('Initialized')
  }

  private registerBuiltinProviders(deps: ScraperProviderDeps): void {
    this.game.registerProvider(new YmgalProvider(deps))
    this.game.registerProvider(new IGDBProvider(deps))
    this.game.registerProvider(new VNDBProvider(deps))
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
