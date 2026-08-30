import type {
  PersonScraperSession,
  PersonScraperSlot,
  PersonSessionResultMap,
  ScrapedPersonInfo
} from '@kisaki3/extension-sdk'
import type { TmdbClient } from '../../api/client'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { parseTmdbDate } from '../format/dates'
import { buildImageUrl, dedupeUrls, selectProfileUrls } from '../format/images'
import { mapTmdbGender } from '../format/roles'
import {
  buildExternalSites,
  homepageSite,
  imdbNameSite,
  tmdbPersonUrl,
  tmdbSite
} from '../format/sites'
import { trimToUndefined } from '../format/text'
import { createPersonLoaders, type TmdbPersonLoaders, type TmdbRequestContext } from '../loaders'
import { toImageContext } from '../runtime'

export function createTmdbPersonSession(
  client: TmdbClient,
  personId: number,
  ctx: TmdbRequestContext
): PersonScraperSession {
  const loaders = createPersonLoaders(client, personId, ctx)
  const tasks = new Map<PersonScraperSlot, Promise<unknown>>()

  return {
    get: async (slots) => {
      const output: Partial<PersonSessionResultMap> = {}

      await Promise.all(
        slots.map(async (slot) => {
          if (!tasks.has(slot)) {
            tasks.set(slot, loadSlot(slot, loaders, ctx))
          }

          const payload = await tasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<PersonScraperSlot, unknown>)[slot] = payload
          }
        })
      )

      return {
        identity: { externalIds: [{ source: TMDB_SOURCE_ID, id: String(personId) }] },
        slots: output
      }
    }
  }
}

function loadSlot(
  slot: PersonScraperSlot,
  loaders: TmdbPersonLoaders,
  ctx: TmdbRequestContext
): Promise<unknown> {
  switch (slot) {
    case 'info':
      return buildPersonInfo(loaders)
    case 'photos':
      return buildPersonPhotos(loaders, ctx)
    // TMDB describes a person only by department, which is a credit of theirs
    // rather than a property of them.
    case 'tags':
      return Promise.resolve(undefined)
  }
}

async function buildPersonInfo(loaders: TmdbPersonLoaders): Promise<ScrapedPersonInfo> {
  const person = await loaders.getPerson()
  // Not user-facing copy: guards a malformed row from entering the library
  // without a name.
  const name = trimToUndefined(person.name) ?? `TMDB ${person.id}`

  return {
    name,
    birthDate: parseTmdbDate(person.birthday),
    deathDate: parseTmdbDate(person.deathday),
    gender: mapTmdbGender(person.gender),
    description: trimToUndefined(person.biography),
    externalSites: buildExternalSites([
      tmdbSite(tmdbPersonUrl(person.id)),
      imdbNameSite(person.imdb_id),
      homepageSite(person.homepage)
    ])
  }
}

async function buildPersonPhotos(
  loaders: TmdbPersonLoaders,
  ctx: TmdbRequestContext
): Promise<string[]> {
  const [person, images] = await Promise.all([loaders.getPerson(), loaders.getImages()])

  return dedupeUrls([
    buildImageUrl(ctx.imageBaseUrl, person.profile_path),
    ...selectProfileUrls(images, toImageContext(ctx))
  ])
}
