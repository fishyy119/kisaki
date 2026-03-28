import type { EntityEntry } from '@shared/scanner'
import type { ExternalId } from '@shared/identity'

export type GameMatchSource = 'phash' | 'folder-name'

export interface MatchedGame {
  gameName: string
  externalIds: ExternalId[]
  matchSource: GameMatchSource
}

/** Game entity with additional game-specific data */
export interface GameEntity extends EntityEntry {
  matchedGame: MatchedGame
}
