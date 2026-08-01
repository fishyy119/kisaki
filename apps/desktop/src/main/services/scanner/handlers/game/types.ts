import type { EntityEntry } from '@shared/scanner'
import type { ExternalId } from '@shared/identity'

export interface MatchedGame {
  gameName: string
  externalIds: ExternalId[]
  /**
   * Origin of the match. The built-in baseline is `folder-name`; hook
   * subscribers may replace it with their own source id (e.g. `phash`).
   */
  matchSource: string
}

/** Game entity with additional game-specific data */
export interface GameEntity extends EntityEntry {
  matchedGame: MatchedGame
}
