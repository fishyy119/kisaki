/**
 * Character scraper provider runtime contract.
 */

import type { CharacterScraperSlot } from '@shared/db'
import type { Tag } from '@shared/metadata'
import type { Locale } from '@shared/locale'
import type {
  CharacterSearchResult,
  ScrapedCharacterInfo,
  ScrapedCharacterPersonFact,
  ScraperCapability,
  ScraperLookup
} from '@shared/scraper'
import { type BaseScraperSession, type IdResolvedTarget } from '../../types'

export type CharacterResolvedTarget = IdResolvedTarget

export interface CharacterSessionResultMap {
  info: ScrapedCharacterInfo
  tags: Tag[]
  persons: ScrapedCharacterPersonFact[]
  photos: string[]
}

export type CharacterScraperSession = BaseScraperSession<
  CharacterScraperSlot,
  CharacterSessionResultMap
>

export interface CharacterScraperProvider {
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability[]

  search(query: string, locale?: Locale): Promise<CharacterSearchResult[]>
  resolve(lookup: ScraperLookup, locale: Locale): Promise<CharacterResolvedTarget | null>
  openSession(target: CharacterResolvedTarget, locale: Locale): Promise<CharacterScraperSession>
}
