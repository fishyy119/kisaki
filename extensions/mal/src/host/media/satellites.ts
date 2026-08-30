/**
 * Fact builders for mirror-served satellite entities (characters and staff).
 * The mirror lists carry name, image, and MAL id only; richer per-person
 * detail would cost one request each and is deliberately not fetched.
 */

import type {
  ScrapedAnimeCharacterFact,
  ScrapedAnimePersonFact,
  ScrapedCharacterPersonFact
} from '@kisaki3/extension-sdk'
import type { MirrorCharacterEdge, MirrorPersonRef, MirrorStaffEdge } from '../api/types'
import { formatMalName, trimToUndefined } from './format/text'
import { mapAnimeStaffPositions, mapCharacterRole } from './format/roles'
import { dedupeUrls, toMalExternalId } from './format/sites'

export function toCharacterFact(edge: MirrorCharacterEdge): ScrapedAnimeCharacterFact | undefined {
  const node = edge.character
  const name = formatMalName(node?.name)
  if (!node || !name) {
    return undefined
  }

  const photos = dedupeUrls([node.images?.jpg?.image_url ?? node.images?.webp?.image_url])
  const voiceActors = (edge.voice_actors ?? [])
    .filter((entry) => entry.language === 'Japanese')
    .map((entry) => toVoiceActorFact(entry.person))
    .filter((fact) => fact !== undefined)

  return {
    name,
    identity: { externalIds: [toMalExternalId(node.mal_id)] },
    photos: photos.length > 0 ? photos : undefined,
    persons: voiceActors.length > 0 ? voiceActors : undefined,
    role: mapCharacterRole(edge.role)
  }
}

export function toStaffFact(edge: MirrorStaffEdge): ScrapedAnimePersonFact | undefined {
  const node = edge.person
  const name = formatMalName(node?.name)
  if (!node || !name) {
    return undefined
  }

  const positions = (edge.positions ?? [])
    .map((position) => trimToUndefined(position))
    .filter((position) => position !== undefined)
  const photos = dedupeUrls([node.images?.jpg?.image_url ?? node.images?.webp?.image_url])

  return {
    name,
    identity: { externalIds: [toMalExternalId(node.mal_id)] },
    photos: photos.length > 0 ? photos : undefined,
    role: mapAnimeStaffPositions(positions),
    note: positions.length > 0 ? positions.join(', ') : undefined
  }
}

function toVoiceActorFact(
  person: MirrorPersonRef | null | undefined
): ScrapedCharacterPersonFact | undefined {
  const name = formatMalName(person?.name)
  if (!person || !name) {
    return undefined
  }

  const photos = dedupeUrls([person.images?.jpg?.image_url ?? person.images?.webp?.image_url])

  return {
    name,
    identity: { externalIds: [toMalExternalId(person.mal_id)] },
    photos: photos.length > 0 ? photos : undefined,
    role: 'actor' as const
  }
}
