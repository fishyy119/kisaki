import type { EntityProjection } from '../types'

export const scannerEntityProjection = {
  entity: 'scanner',
  coreFields: {
    name: 'name',
    path: 'path',
    type: 'type',
    scraper_profile_id: 'scraperProfileId',
    target_collection_id: 'targetCollectionId',
    scan_interval_minutes: 'scanIntervalMinutes',
    entity_depth: 'entityDepth',
    name_extraction_rules: 'nameExtractionRules'
  }
} satisfies EntityProjection
