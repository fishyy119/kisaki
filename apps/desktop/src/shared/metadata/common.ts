/**
 * Common Metadata Types
 *
 * Shared type definitions used across entity metadata.
 */
export type { ExternalId } from '@shared/identity'

/**
 * Tag data for any entity.
 */
export interface Tag {
  name: string
  isSpoiler?: boolean
  note?: string
  isNsfw?: boolean
}
