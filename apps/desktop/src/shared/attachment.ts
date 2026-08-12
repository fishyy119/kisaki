/**
 * Attachment service shared types
 */

/**
 * Media file types for game assets
 *
 * Used across attachment service, IPC handlers, and UI components.
 */
export type GameMediaType = 'cover' | 'backdrop' | 'logo' | 'icon'

export type GameMediaField = 'coverFile' | 'backdropFile' | 'logoFile' | 'iconFile'

export const GAME_MEDIA_TYPE_TO_FIELD: Record<GameMediaType, GameMediaField> = {
  cover: 'coverFile',
  backdrop: 'backdropFile',
  logo: 'logoFile',
  icon: 'iconFile'
}

/** Media file types for anime assets; anime has no launcher icon. */
export type AnimeMediaType = 'cover' | 'backdrop' | 'logo'

export type AnimeMediaField = 'coverFile' | 'backdropFile' | 'logoFile'

export const ANIME_MEDIA_TYPE_TO_FIELD: Record<AnimeMediaType, AnimeMediaField> = {
  cover: 'coverFile',
  backdrop: 'backdropFile',
  logo: 'logoFile'
}

/**
 * Crop region for image editing operations
 */
export interface CropRegion {
  x: number
  y: number
  width: number
  height: number
}
