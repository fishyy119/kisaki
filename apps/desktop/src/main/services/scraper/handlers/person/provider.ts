/**
 * Person scraper provider runtime contract.
 */

import type { PersonScraperSlot } from '@shared/db'
import type { Tag } from '@shared/metadata'
import type {
  PersonSearchResult,
  ScrapedPersonInfo,
  ScraperCapability,
  ScraperLookup
} from '@shared/scraper'
import {
  type BaseScraperSession,
  type IdResolvedTarget,
  type ScraperProviderContext
} from '../../types'

export type PersonResolvedTarget = IdResolvedTarget

export interface PersonSessionResultMap {
  info: ScrapedPersonInfo
  tags: Tag[]
  photos: string[]
}

export type PersonScraperSession = BaseScraperSession<PersonScraperSlot, PersonSessionResultMap>

export interface PersonScraperProvider {
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability[]

  search(query: string, ctx: ScraperProviderContext): Promise<PersonSearchResult[]>
  resolve(lookup: ScraperLookup, ctx: ScraperProviderContext): Promise<PersonResolvedTarget | null>
  openSession(
    target: PersonResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<PersonScraperSession>
}
