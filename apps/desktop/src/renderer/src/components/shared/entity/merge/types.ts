import type { AllEntityType } from '@shared/common'

export interface EntityMergeSummary {
  entityType: AllEntityType
  id: string
  name: string
  subText?: string
  imageUrl?: string | null
}
