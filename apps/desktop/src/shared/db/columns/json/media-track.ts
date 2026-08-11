/**
 * Track summary columns for media files.
 *
 * Values originate from an external prober, so reads are total and degrade
 * malformed content to an empty track list; writes are strict and round-trip
 * through the same parser.
 */

import { customType } from 'drizzle-orm/sqlite-core'

import type { MediaAudioTrack, MediaSubtitleTrack } from '../../../media-info'
import { matchesPlainObject, requireCanonicalJsonValue, stringifyJsonStorageValue } from './utils'

function parseTrackIndex(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function parseNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function parseBoolean(value: unknown): boolean {
  return value === true
}

function parseAudioTrack(value: unknown): MediaAudioTrack | null {
  if (!matchesPlainObject(value)) return null

  const index = parseTrackIndex(value.index)
  if (index === null) return null

  const channels = typeof value.channels === 'number' && value.channels > 0 ? value.channels : null

  return {
    index,
    codec: parseNullableString(value.codec),
    language: parseNullableString(value.language),
    title: parseNullableString(value.title),
    channels,
    isDefault: parseBoolean(value.isDefault)
  }
}

function parseSubtitleTrack(value: unknown): MediaSubtitleTrack | null {
  if (!matchesPlainObject(value)) return null

  const index = parseTrackIndex(value.index)
  if (index === null) return null

  return {
    index,
    codec: parseNullableString(value.codec),
    language: parseNullableString(value.language),
    title: parseNullableString(value.title),
    isDefault: parseBoolean(value.isDefault),
    isForced: parseBoolean(value.isForced)
  }
}

function parseTrackList<T>(value: string | null, parseTrack: (item: unknown) => T | null): T[] {
  if (!value || value === '[]') return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((item) => {
      const track = parseTrack(item)
      return track ? [track] : []
    })
  } catch {
    return []
  }
}

function createTrackListType<T>(typeName: string, parseTrack: (item: unknown) => T | null) {
  return customType<{ data: T[]; driverData: string }>({
    dataType() {
      return 'text'
    },

    fromDriver(value: string): T[] {
      return parseTrackList(value, parseTrack)
    },

    toDriver(value: T[]): string {
      if (!Array.isArray(value)) {
        throw new Error(`${typeName} must be an array`)
      }

      const canonical = value.map((item, index) => {
        const track = parseTrack(item)
        if (!track) {
          throw new Error(`${typeName} has an invalid track at index ${index}`)
        }
        return track
      })

      return stringifyJsonStorageValue(
        typeName,
        requireCanonicalJsonValue(typeName, value, canonical)
      )
    }
  })
}

export const audioTracks = createTrackListType<MediaAudioTrack>('audioTracks', parseAudioTrack)

export const subtitleTracks = createTrackListType<MediaSubtitleTrack>(
  'subtitleTracks',
  parseSubtitleTrack
)
