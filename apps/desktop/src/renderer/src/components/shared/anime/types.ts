import type { ExternalId } from '@shared/identity'

/** Current selection state for parent component */
export interface AnimeSearcherSelection {
  profileId: string
  animeId: string
  animeName: string
  originalName?: string
  knownIds: ExternalId[]
  canSubmit: boolean
}
