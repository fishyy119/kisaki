import type {
  ScrapedAnimePersonFact,
  ScrapedMoviePersonFact,
  ScrapedPersonMetadata,
  ScrapedTvPersonFact
} from '@kisaki3/extension-sdk'
import type { TmdbCastMember, TmdbCreditPerson, TmdbCredits, TmdbCrewMember } from '../../api/types'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { omitUndefined } from '../../utils/object'
import { buildImageUrl } from './images'
import {
  mapTmdbCrewRole,
  mapTmdbGender,
  mapTmdbMoviePersonRole,
  mapTmdbTvPersonRole
} from './roles'
import { buildExternalSites, tmdbPersonUrl, tmdbSite } from './sites'
import { trimToUndefined } from './text'

/** Joins the several characters one cast credit can cover. */
const CHARACTER_SEPARATOR = ' | '

/**
 * TMDB decorations on a credited character name.
 *
 * `(voice)` restates what an animation actor role already says, and
 * `(as <name>)` gives the performer's credit alias rather than the character.
 * Both are noise in a cast note, and dropping them lets a character credited
 * under two spellings collapse into one entry instead of reading as two.
 */
const CHARACTER_DECORATIONS = /\s*\((?:voice|as\s[^)]*)\)/gi

/** One credit as a library person fact, with the media type's own role. */
type PersonFact<TRole extends string> = ScrapedPersonMetadata & { role: TRole; note?: string }

/**
 * Credits as library person facts.
 *
 * TMDB reports one credit per job, and aggregate TV credits pack several jobs
 * or characters into a single row, so both shapes are flattened first. A person
 * keeps one fact per distinct role: the same name credited as both writer and
 * director is two facts, but two writing credits are one. The characters played
 * travel as the note, because TMDB has no character entity of its own.
 */
function buildPersonFacts<TRole extends string>(
  credits: TmdbCredits,
  imageBaseUrl: string,
  mapCrewRole: (job: string) => TRole | undefined,
  actorRole: TRole
): PersonFact<TRole>[] {
  const facts = new Map<string, PersonFact<TRole>>()

  for (const member of credits.crew ?? []) {
    for (const job of readJobs(member)) {
      const role = mapCrewRole(job)
      if (!role) {
        continue
      }

      const key = `${member.id}:${role}`
      if (facts.has(key)) {
        continue
      }

      facts.set(key, toPersonFact(member, role, job, imageBaseUrl))
    }
  }

  for (const member of credits.cast ?? []) {
    const key = `${member.id}:${actorRole}`
    if (facts.has(key)) {
      continue
    }

    const characters = readCharacters(member).join(CHARACTER_SEPARATOR)
    facts.set(key, toPersonFact(member, actorRole, characters, imageBaseUrl))
  }

  return [...facts.values()]
}

/**
 * The whole cast of an animated title is a voice cast, so unlike crew jobs it
 * needs no vocabulary to be recognized.
 */
export function buildAnimePersonFacts(
  credits: TmdbCredits,
  imageBaseUrl: string
): ScrapedAnimePersonFact[] {
  return buildPersonFacts(credits, imageBaseUrl, mapTmdbCrewRole, 'actor')
}

export function buildTvPersonFacts(
  credits: TmdbCredits,
  imageBaseUrl: string
): ScrapedTvPersonFact[] {
  return buildPersonFacts(credits, imageBaseUrl, mapTmdbTvPersonRole, 'actor')
}

export function buildMoviePersonFacts(
  credits: TmdbCredits,
  imageBaseUrl: string
): ScrapedMoviePersonFact[] {
  return buildPersonFacts(credits, imageBaseUrl, mapTmdbMoviePersonRole, 'actor')
}

function readJobs(member: TmdbCrewMember): string[] {
  const jobs = (member.jobs ?? [])
    .map((entry) => trimToUndefined(entry.job))
    .filter((job): job is string => job !== undefined)

  const flatJob = trimToUndefined(member.job)
  if (flatJob) {
    jobs.push(flatJob)
  }

  return jobs
}

function readCharacters(member: TmdbCastMember): string[] {
  const characters = (member.roles ?? [])
    .map((entry) => toCharacterLabel(entry.character))
    .filter((character): character is string => character !== undefined)

  const flatCharacter = toCharacterLabel(member.character)
  if (flatCharacter) {
    characters.push(flatCharacter)
  }

  // One note carries them all, so a repeat would be visible to the reader.
  return [...new Set(characters)]
}

function toCharacterLabel(character: string | undefined): string | undefined {
  return trimToUndefined(character?.replace(CHARACTER_DECORATIONS, ''))
}

function toPersonFact<TRole extends string>(
  member: TmdbCreditPerson,
  role: TRole,
  note: string | undefined,
  imageBaseUrl: string
): PersonFact<TRole> {
  const originalName = trimToUndefined(member.original_name)
  // Not user-facing copy: guards a malformed credit row from entering the
  // library without a name.
  const name = trimToUndefined(member.name) ?? originalName ?? `TMDB ${member.id}`
  const photo = buildImageUrl(imageBaseUrl, member.profile_path)

  return {
    ...omitUndefined({
      name,
      originalName: originalName && originalName !== name ? originalName : undefined,
      gender: mapTmdbGender(member.gender),
      externalSites: buildExternalSites([tmdbSite(tmdbPersonUrl(member.id))]),
      photos: photo ? [photo] : undefined,
      note: trimToUndefined(note)
    }),
    identity: { externalIds: [{ source: TMDB_SOURCE_ID, id: String(member.id) }] },
    role
  }
}
