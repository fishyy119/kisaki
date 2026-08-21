import type {
  LibraryAnimeCompanyRole,
  LibraryAnimePersonRole,
  LibraryGender
} from '@kisaki3/extension-sdk'

/**
 * TMDB crew jobs mapped onto the library's anime staff vocabulary.
 *
 * The table is the whole rule: a job it does not name is dropped rather than
 * folded into `other`. TMDB credits every department of a production, and a
 * feature film alone lists hundreds of jobs the library has no role for, so an
 * `other` catch-all would import crowds of people nobody browses by. The exact
 * job always travels along as the credit note, so the coarser role never loses
 * the precise wording.
 */
const ANIME_PERSON_ROLE_BY_JOB: Record<string, LibraryAnimePersonRole> = {
  'original series creator': 'originalCreator',
  creator: 'originalCreator',
  'original story': 'originalCreator',
  'original concept': 'originalCreator',
  novel: 'originalCreator',
  'comic book': 'originalCreator',
  characters: 'originalCreator',

  director: 'director',
  'series director': 'director',
  'co-director': 'director',
  'chief director': 'director',

  'series composition': 'seriesComposition',

  writer: 'scenario',
  screenplay: 'scenario',
  story: 'scenario',
  script: 'scenario',
  'scenario writer': 'scenario',
  'staff writer': 'scenario',

  'episode director': 'episodeDirector',
  storyboard: 'episodeDirector',
  'storyboard artist': 'episodeDirector',

  'character designer': 'characterDesign',
  'character design': 'characterDesign',
  'mechanical designer': 'characterDesign',

  'animation director': 'animationDirector',
  'chief animation director': 'animationDirector',
  'supervising animator': 'animationDirector',

  animation: 'animation',
  'key animation': 'animation',
  'in-between animation': 'animation',
  animator: 'animation',
  'lead animator': 'animation',

  'art direction': 'art',
  'art designer': 'art',
  'production design': 'art',
  'background designer': 'art',
  'color designer': 'art',

  'director of photography': 'photography',
  cinematography: 'photography',
  photography: 'photography',

  'sound director': 'sound',
  'sound designer': 'sound',
  'sound effects': 'sound',
  'sound editor': 'sound',
  'sound re-recording mixer': 'sound',
  'supervising sound editor': 'sound',

  'original music composer': 'music',
  music: 'music',
  'music director': 'music',
  'music supervisor': 'music',
  composer: 'music',
  songs: 'music',
  'theme song performance': 'music',

  producer: 'producer',
  'executive producer': 'producer',
  'co-producer': 'producer',
  'associate producer': 'producer',
  'line producer': 'producer',
  'animation producer': 'producer',
  'executive in charge of production': 'producer'
}

export function mapTmdbCrewRole(job: string | undefined): LibraryAnimePersonRole | undefined {
  const normalized = job?.trim().toLowerCase()
  return normalized ? ANIME_PERSON_ROLE_BY_JOB[normalized] : undefined
}

/**
 * TMDB separates the companies that make a show from the networks that carry
 * it; `distributor` is the anime role that matches a carrier.
 */
export function mapTmdbCompanyRole(kind: 'production' | 'network'): LibraryAnimeCompanyRole {
  return kind === 'network' ? 'distributor' : 'studio'
}

/** TMDB gender: 1 female, 2 male, 3 non-binary, 0 or absent unknown. */
export function mapTmdbGender(gender: number | undefined): LibraryGender | undefined {
  switch (gender) {
    case 1:
      return 'female'
    case 2:
      return 'male'
    case 3:
      return 'other'
    default:
      return undefined
  }
}
