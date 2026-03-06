/**
 * Ingest contracts for character add orchestration.
 */

import type { CoreCharacterMetadata, CorePersonMetadata } from '@shared/metadata'
import type { CharacterPersonType } from '@shared/db'
import type {
  IngestAddCharacterResult,
  IngestAddCharacterFromScraperOptions,
  IngestEntityNode,
  IngestFromScraperParamsBase,
  IngestLinkBase
} from './common'

/**
 * Character node in normalized ingest graph.
 */
export interface IngestCharacterNode extends IngestEntityNode<CoreCharacterMetadata> {
  photoUrls?: string[]
}

/**
 * Person node used by character flow.
 */
export interface IngestCharacterPersonNode extends IngestEntityNode<CorePersonMetadata> {
  photoUrls?: string[]
}

/**
 * Character -> Person edge in ingest graph.
 */
export interface IngestCharacterPersonLink extends IngestLinkBase {
  characterIdentityKey: string
  personIdentityKey: string
  type: CharacterPersonType
  orderInCharacter: number
  orderInPerson: number
}

/**
 * Canonical normalized graph produced by ingest for character flow.
 */
export interface IngestCharacterGraph {
  character: IngestCharacterNode
  persons: IngestCharacterPersonNode[]
  links: IngestCharacterPersonLink[]
}

/**
 * IPC params for ingest:add-character-from-scraper.
 */
export type IngestAddCharacterFromScraperParams =
  IngestFromScraperParamsBase<IngestAddCharacterFromScraperOptions>

/**
 * IPC result for ingest:add-character-from-scraper.
 */
export type IngestAddCharacterFromScraperResult = IngestAddCharacterResult
