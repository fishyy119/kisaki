import type { Status } from '@shared/db/enums'
import type { RawDbChangeEvent } from '@shared/events/library'

export const PROJECTOR_DEBOUNCE_MS = 25

export type LibraryEntityTopic = 'game' | 'person' | 'company' | 'character' | 'collection' | 'tag'

export type ProjectedEntityTopic = LibraryEntityTopic | 'scanner'

export type ConfiguredEntityTopic = Exclude<ProjectedEntityTopic, 'game'>

export interface EntityGroup {
  entity: ProjectedEntityTopic
  id: string
  changes: RawDbChangeEvent[]
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
