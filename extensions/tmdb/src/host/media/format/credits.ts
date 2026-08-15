import type { ScrapedAnimePersonFact } from '@kisaki3/extension-sdk'
import type { TmdbCastMember, TmdbCreditPerson, TmdbCredits, TmdbCrewMember } from '../../api/types'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { omitUndefined } from '../../utils/object'
import { buildImageUrl } from './images'
import { mapTmdbCrewRole, mapTmdbGender } from './roles'
import { buildExternalSites, tmdbPersonUrl, tmdbSite } from './sites'
import { trimToUndefined } from './text'

/** Joins the several characters one voice credit can cover. */
const CHARACTER_SEPARATOR = ' | '

/**
 * TMDB decorations on an animation character name.
 *
 * `(voice)` restates what the actor role already says, and `(as <name>)` gives
 * the performer's credit alias rather than the character. Both are noise in a
 * cast note, and dropping them lets a character credited under two spellings
 * collapse into one entry instead of reading as two characters.
 */
const CHARACTER_DECORATIONS = /\s*\((?:voice|as\s[^)]*)\)/gi

/**
 * Credits as library person facts.
 *
 * TMDB reports one credit per job, and aggregate TV credits pack several jobs
 * or characters into a single row, so both shapes are flattened first. A person
 * keeps one fact per distinct role: the same name credited as both writer and
 * director is two facts, but two writing credits are one.
 */
export function buildAnimePersonFacts(
  credits: TmdbCredits,
  imageBaseUrl: string
): ScrapedAnimePersonFact[] {
  const facts = new Map<string, ScrapedAnimePersonFact>()

  for (const member of credits.crew ?? []) {
    for (const job of readJobs(member)) {
      const role = mapTmdbCrewRole(job)
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

  // The whole cast of an animated title is a voice cast, so unlike crew jobs it
  // needs no vocabulary to be recognized. TMDB has no character entity, so the
  // characters played travel as the note and the anime-person link is what
  // records that this entry cast this voice.
  for (const member of credits.cast ?? []) {
    const key = `${member.id}:actor`
    if (facts.has(key)) {
      continue
    }

    const characters = readCharacters(member).join(CHARACTER_SEPARATOR)
    facts.set(key, toPersonFact(member, 'actor', characters, imageBaseUrl))
  }

  return [...facts.values()]
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

function toPersonFact(
  member: TmdbCreditPerson,
  role: ScrapedAnimePersonFact['role'],
  note: string | undefined,
  imageBaseUrl: string
): ScrapedAnimePersonFact {
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
