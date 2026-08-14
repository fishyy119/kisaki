import type { ScrapedAnimePersonFact } from '@kisaki3/extension-sdk'
import type { TmdbCrewMember } from '../../api/types'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { omitUndefined } from '../../utils/object'
import { buildImageUrl } from './images'
import { mapTmdbCrewRole, mapTmdbGender } from './roles'
import { buildExternalSites, tmdbPersonUrl, tmdbSite } from './sites'
import { trimToUndefined } from './text'

/**
 * Crew credits as library staff facts.
 *
 * TMDB reports one credit per job, and aggregate TV credits pack several jobs
 * into a single crew row, so both shapes are flattened to job level first. A
 * person keeps one fact per distinct role: the same name credited as both
 * writer and director is two facts, but two writing credits are one.
 */
export function buildAnimePersonFacts(
  crew: readonly TmdbCrewMember[] | undefined,
  imageBaseUrl: string
): ScrapedAnimePersonFact[] {
  const facts = new Map<string, ScrapedAnimePersonFact>()

  for (const member of crew ?? []) {
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

function toPersonFact(
  member: TmdbCrewMember,
  role: ScrapedAnimePersonFact['role'],
  job: string,
  imageBaseUrl: string
): ScrapedAnimePersonFact {
  const originalName = trimToUndefined(member.original_name)
  // Not user-facing copy: guards a malformed crew row from entering the library
  // without a name.
  const name = trimToUndefined(member.name) ?? originalName ?? `TMDB ${member.id}`
  const photo = buildImageUrl(imageBaseUrl, member.profile_path)

  return {
    ...omitUndefined({
      name,
      originalName: originalName && originalName !== name ? originalName : undefined,
      gender: mapTmdbGender(member.gender),
      externalSites: buildExternalSites([tmdbSite(tmdbPersonUrl(member.id))]),
      photos: photo ? [photo] : undefined,
      note: job
    }),
    identity: { externalIds: [{ source: TMDB_SOURCE_ID, id: String(member.id) }] },
    role
  }
}
