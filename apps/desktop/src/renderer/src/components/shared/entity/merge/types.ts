import type { AllEntityType } from '@shared/entity-types'

export interface EntityMergeSummary {
  entityType: AllEntityType
  id: string
  name: string
  subText?: string
  imageUrl?: string | null
}
