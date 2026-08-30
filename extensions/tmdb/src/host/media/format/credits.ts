import type { ScrapedAnimePersonFact, ScrapedPersonMetadata } from '@kisaki3/extension-sdk'
import type { TmdbCreditPerson, TmdbCredits, TmdbCrewMember } from '../../api/types'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { buildImageUrl } from './images'
import { mapTmdbCrewRole, mapTmdbGender } from './roles'
import { buildExternalSites, tmdbPersonUrl, tmdbSite } from './sites'
import { trimToUndefined } from './text'

/** One credit as a library person fact, with the media type's own role. */
type PersonFact<TRole extends string> = ScrapedPersonMetadata & {
  role: TRole
  note?: string
}

/**
 * Credits as library person facts.
 *
 * TMDB reports one credit per job and aggregate credits pack several jobs into
 * a single row, so both shapes are flattened first. A person keeps one fact per
 * distinct role: the same name credited as both writer and director is two
 * facts, but two writing credits are one.
 *
 * A cast credit states only that the person is credited in this entry. TMDB has
 * no character entity, so it cannot name who they voice; that three-way fact
 * comes from providers whose characters have identities of their own.
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

      facts.set(key, { ...toPersonFact(member, role, imageBaseUrl), note: job })
    }
  }

  for (const member of credits.cast ?? []) {
    const key = `${member.id}:${actorRole}`
    if (!facts.has(key)) {
      facts.set(key, toPersonFact(member, actorRole, imageBaseUrl))
    }
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

function toPersonFact<TRole extends string>(
  member: TmdbCreditPerson,
  role: TRole,
  imageBaseUrl: string
): PersonFact<TRole> {
  const originalName = trimToUndefined(member.original_name)
  // Not user-facing copy: guards a malformed credit row from entering the
  // library without a name.
  const name = trimToUndefined(member.name) ?? originalName ?? `TMDB ${member.id}`
  const photo = buildImageUrl(imageBaseUrl, member.profile_path)

  return {
    ...{
      name,
      originalName: originalName && originalName !== name ? originalName : undefined,
      gender: mapTmdbGender(member.gender),
      externalSites: buildExternalSites([tmdbSite(tmdbPersonUrl(member.id))]),
      photos: photo ? [photo] : undefined
    },
    identity: { externalIds: [{ source: TMDB_SOURCE_ID, id: String(member.id) }] },
    role
  }
}
