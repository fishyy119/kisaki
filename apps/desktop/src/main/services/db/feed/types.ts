import type { Status } from '@shared/db/contracts/enums'
import type { RawDbChange } from '@shared/db/changes'
import type { LibraryEntityTopic } from '@shared/library'

export const FEED_DEBOUNCE_MS = 25

/** Upper bound on summaries per `db:changed` push, so bulk writes stay deliverable. */
export const FEED_PUSH_CHUNK_SIZE = 2000

export type ConfiguredEntityTopic = Exclude<LibraryEntityTopic, 'game'>

export interface EntityGroup {
  entity: LibraryEntityTopic
  id: string
  changes: RawDbChange[]
}

export interface GameRow {
  id: string
  name: string
  status: Status
  score: number | null
  total_duration: number
  last_active_at: number | null
}

export type IdSnapshotReader = (gameId: string) => string[]

export interface EntityProjection {
  entity: ConfiguredEntityTopic
  coreFields: Record<string, string>
  scoreField?: string
  assetFields?: Record<string, string>
  dynamicConfigFields?: Record<string, string>
}
