import type {
  CharacterMetadataUpdateField,
  CharacterMetadataUpdateInput,
  CharacterMetadataUpdatePayload,
  CompanyMetadataUpdateField,
  CompanyMetadataUpdateInput,
  CompanyMetadataUpdatePayload,
  GameMetadataUpdateField,
  GameMetadataUpdateInput,
  GameMetadataUpdatePayload,
  PersonMetadataUpdateField,
  PersonMetadataUpdateInput,
  PersonMetadataUpdatePayload
} from '@shared/metadata-updater'
import type {
  ScrapedCharacterBundle,
  ScrapedCompanyBundle,
  ScrapedGameBundle,
  ScrapedPersonBundle
} from '@shared/scraper'
import { normalizeExternalIds, type ExternalId } from '@shared/identity'

export function dedupeExternalIds(externalIds: ExternalId[]): ExternalId[] {
  return normalizeExternalIds(externalIds)
}

export function mergeExternalIds(a: ExternalId[], b: ExternalId[]): ExternalId[] {
  return dedupeExternalIds([...(a ?? []), ...(b ?? [])])
}

export function fieldsToOption<Field extends string>(
  selected: Field[],
  all: readonly Field[]
): Field[] | '#all' {
  if (selected.length === all.length) return '#all'
  return selected
}

function pickFields<T extends object, Field extends keyof T>(
  obj: T,
  fields: readonly Field[]
): Partial<Pick<T, Field>> {
  const out: Partial<Pick<T, Field>> = {}
  for (const field of fields) {
    if (field in obj) {
      out[field] = obj[field]
    }
  }
  return out
}

export function toGameMetadataUpdateInput(
  bundle: ScrapedGameBundle,
  fields: readonly GameMetadataUpdateField[]
): GameMetadataUpdateInput {
  const payload: Partial<GameMetadataUpdatePayload> = {
    ...(bundle.core ?? {})
  }

  const coverUrl = bundle.mediaCandidates?.coverUrls?.[0]
  const backdropUrl = bundle.mediaCandidates?.backdropUrls?.[0]
  const logoUrl = bundle.mediaCandidates?.logoUrls?.[0]
  const iconUrl = bundle.mediaCandidates?.iconUrls?.[0]

  if (coverUrl) payload.covers = [coverUrl]
  if (backdropUrl) payload.backdrops = [backdropUrl]
  if (logoUrl) payload.logos = [logoUrl]
  if (iconUrl) payload.icons = [iconUrl]

  return pickFields(payload, fields)
}

export function toPersonMetadataUpdateInput(
  bundle: ScrapedPersonBundle,
  fields: readonly PersonMetadataUpdateField[]
): PersonMetadataUpdateInput {
  const payload: Partial<PersonMetadataUpdatePayload> = {
    ...(bundle.core ?? {})
  }

  const photoUrl = bundle.mediaCandidates?.photoUrls?.[0]
  if (photoUrl) payload.photos = [photoUrl]

  return pickFields(payload, fields)
}

export function toCompanyMetadataUpdateInput(
  bundle: ScrapedCompanyBundle,
  fields: readonly CompanyMetadataUpdateField[]
): CompanyMetadataUpdateInput {
  const payload: Partial<CompanyMetadataUpdatePayload> = {
    ...(bundle.core ?? {})
  }

  const logoUrl = bundle.mediaCandidates?.logoUrls?.[0]
  if (logoUrl) payload.logos = [logoUrl]

  return pickFields(payload, fields)
}

export function toCharacterMetadataUpdateInput(
  bundle: ScrapedCharacterBundle,
  fields: readonly CharacterMetadataUpdateField[]
): CharacterMetadataUpdateInput {
  const payload: Partial<CharacterMetadataUpdatePayload> = {
    ...(bundle.core ?? {})
  }

  const photoUrl = bundle.mediaCandidates?.photoUrls?.[0]
  if (photoUrl) payload.photos = [photoUrl]

  return pickFields(payload, fields)
}
