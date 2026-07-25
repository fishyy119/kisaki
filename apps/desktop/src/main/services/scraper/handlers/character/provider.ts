/**
 * Character scraper provider runtime contract.
 */

import type { CharacterScraperSlot } from '@shared/db'
import type { Tag } from '@shared/metadata'
import type { ContentLocale } from '@shared/i18n'
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

  search(query: string, locale?: ContentLocale): Promise<CharacterSearchResult[]>
  resolve(lookup: ScraperLookup, locale: ContentLocale): Promise<CharacterResolvedTarget | null>
  openSession(
    target: CharacterResolvedTarget,
    locale: ContentLocale
  ): Promise<CharacterScraperSession>
}
