/**
 * Link-table topology for metadata updates.
 *
 * Each link table is declared once with the surface that owns it and the fact
 * sources that feed it. Writing a table needs its surface answered; clearing it
 * needs every source answered, so `replace` degrades to `merge` when the scrape
 * could not speak for one of them. A table may also refuse deletion outright,
 * which is a property of what it stores rather than of any one scrape.
 *
 * Link kinds come from the graph builder's output, so a new link table cannot
 * be added without declaring its surface and sources here. Adding another
 * source to an existing table is not compiler-checked: keep `sources` in step
 * with the graph builders in `../graph`.
 */

import type { IngestWarning } from '@shared/ingest'
import type {
  AnimeUpdateRelationSurface,
  CharacterUpdateRelationSurface,
  ComicUpdateRelationSurface,
  GameUpdateRelationSurface,
  NovelUpdateRelationSurface
} from '@shared/ingest/update'
import type {
  ScrapedAnimeRelationFacts,
  ScrapedCharacterRelationFacts,
  ScrapedComicRelationFacts,
  ScrapedGameRelationFacts,
  ScrapedNovelRelationFacts
} from '@shared/scraper'
import type { CollectionUpdateMode, UpdateIncomingRelationAvailability } from './types'
import type { AnimeLinkKind } from './anime/types'
import type { CharacterLinkKind } from './character/types'
import type { ComicLinkKind } from './comic/types'
import type { GameLinkKind } from './game/types'
import type { NovelLinkKind } from './novel/types'

interface LinkTopologySpec<TSurface extends string, TFactSource extends string> {
  /** Update surface that selects this link table. */
  surface: TSurface
  /** Stable English noun used when reporting a downgraded replace. */
  label: string
  /** Fact sources that contribute rows; all must answer before rows may be deleted. */
  sources: readonly TFactSource[]
  /**
   * Rows a scrape may add but never delete, whatever mode was requested.
   *
   * Unlike a degraded replace this is not a shortfall a better-answering
   * source could lift, so it reports no warning: the table states knowledge
   * that outlives the work being scraped.
   */
  mergeOnly?: true
}

/** Fact sources a game scrape can answer for, named after the slots that fill them. */
type GameRelationFactSource = 'persons' | 'companies' | 'characters' | 'cast'

const GAME_FACT_SOURCE_ANSWERED: Record<
  GameRelationFactSource,
  (facts: ScrapedGameRelationFacts) => boolean
> = {
  persons: (facts) => facts.gamePerson !== undefined,
  companies: (facts) => facts.gameCompany !== undefined,
  characters: (facts) => facts.gameCharacter !== undefined,
  // Character-person facts arrive either as a top-level list or nested in every
  // character, so one definitive channel answers for the whole set.
  cast: (facts) =>
    facts.characterPerson !== undefined ||
    (facts.gameCharacter !== undefined &&
      facts.gameCharacter.every((fact) => fact.persons !== undefined))
}

export const GAME_LINK_TOPOLOGY: Record<
  GameLinkKind,
  LinkTopologySpec<GameUpdateRelationSurface, GameRelationFactSource>
> = {
  gamePerson: {
    surface: 'person',
    label: 'game person links',
    sources: ['persons', 'cast']
  },
  gameCompany: {
    surface: 'company',
    label: 'game company links',
    sources: ['companies']
  },
  gameCharacter: {
    surface: 'character',
    label: 'game character links',
    sources: ['characters']
  },
  gameCast: {
    surface: 'characterPerson',
    label: 'game cast links',
    sources: ['cast']
  },
  characterPerson: {
    surface: 'characterPerson',
    label: 'character person links',
    sources: ['cast'],
    // The knowledge layer: who voices a character at all, independent of any
    // one work. This entry's scrape proves a credit exists, never that a
    // stored one is wrong; the per-entry answer is the cast table's.
    mergeOnly: true
  }
}

/** Fact sources an anime scrape can answer for, named after the slots that fill them. */
type AnimeRelationFactSource = 'persons' | 'companies' | 'characters' | 'cast'

const ANIME_FACT_SOURCE_ANSWERED: Record<
  AnimeRelationFactSource,
  (facts: ScrapedAnimeRelationFacts) => boolean
> = {
  persons: (facts) => facts.animePerson !== undefined,
  companies: (facts) => facts.animeCompany !== undefined,
  characters: (facts) => facts.animeCharacter !== undefined,
  // Character-person facts arrive either as a top-level list or nested in every
  // character, so one definitive channel answers for the whole set.
  cast: (facts) =>
    facts.characterPerson !== undefined ||
    (facts.animeCharacter !== undefined &&
      facts.animeCharacter.every((fact) => fact.persons !== undefined))
}

export const ANIME_LINK_TOPOLOGY: Record<
  AnimeLinkKind,
  LinkTopologySpec<AnimeUpdateRelationSurface, AnimeRelationFactSource>
> = {
  animePerson: {
    surface: 'person',
    label: 'anime person links',
    sources: ['persons', 'cast']
  },
  animeCompany: {
    surface: 'company',
    label: 'anime company links',
    sources: ['companies']
  },
  animeCharacter: {
    surface: 'character',
    label: 'anime character links',
    sources: ['characters']
  },
  animeCast: {
    surface: 'characterPerson',
    label: 'anime cast links',
    sources: ['cast']
  },
  characterPerson: {
    surface: 'characterPerson',
    label: 'character person links',
    sources: ['cast'],
    // Knowledge layer; see `GAME_LINK_TOPOLOGY.characterPerson`.
    mergeOnly: true
  }
}

/** Fact sources a comic scrape can answer for, named after the slots that fill them. */
type ComicRelationFactSource = 'persons' | 'companies' | 'characters' | 'characterPersons'

const COMIC_FACT_SOURCE_ANSWERED: Record<
  ComicRelationFactSource,
  (facts: ScrapedComicRelationFacts) => boolean
> = {
  persons: (facts) => facts.comicPerson !== undefined,
  companies: (facts) => facts.comicCompany !== undefined,
  characters: (facts) => facts.comicCharacter !== undefined,
  // Character-person facts arrive either as a top-level list or nested in every
  // character, so one definitive channel answers for the whole set.
  characterPersons: (facts) =>
    facts.characterPerson !== undefined ||
    (facts.comicCharacter !== undefined &&
      facts.comicCharacter.every((fact) => fact.persons !== undefined))
}

export const COMIC_LINK_TOPOLOGY: Record<
  ComicLinkKind,
  LinkTopologySpec<ComicUpdateRelationSurface, ComicRelationFactSource>
> = {
  comicPerson: {
    surface: 'person',
    label: 'comic person links',
    sources: ['persons', 'characterPersons']
  },
  comicCompany: {
    surface: 'company',
    label: 'comic company links',
    sources: ['companies']
  },
  comicCharacter: {
    surface: 'character',
    label: 'comic character links',
    sources: ['characters']
  },
  characterPerson: {
    surface: 'characterPerson',
    label: 'character person links',
    sources: ['characterPersons'],
    // Knowledge layer; see `GAME_LINK_TOPOLOGY.characterPerson`.
    mergeOnly: true
  }
}

/** Fact sources a novel scrape can answer for, named after the slots that fill them. */
type NovelRelationFactSource = 'persons' | 'companies' | 'characters' | 'characterPersons'

const NOVEL_FACT_SOURCE_ANSWERED: Record<
  NovelRelationFactSource,
  (facts: ScrapedNovelRelationFacts) => boolean
> = {
  persons: (facts) => facts.novelPerson !== undefined,
  companies: (facts) => facts.novelCompany !== undefined,
  characters: (facts) => facts.novelCharacter !== undefined,
  // Character-person facts arrive either as a top-level list or nested in every
  // character, so one definitive channel answers for the whole set.
  characterPersons: (facts) =>
    facts.characterPerson !== undefined ||
    (facts.novelCharacter !== undefined &&
      facts.novelCharacter.every((fact) => fact.persons !== undefined))
}

export const NOVEL_LINK_TOPOLOGY: Record<
  NovelLinkKind,
  LinkTopologySpec<NovelUpdateRelationSurface, NovelRelationFactSource>
> = {
  novelPerson: {
    surface: 'person',
    label: 'novel person links',
    sources: ['persons', 'characterPersons']
  },
  novelCompany: {
    surface: 'company',
    label: 'novel company links',
    sources: ['companies']
  },
  novelCharacter: {
    surface: 'character',
    label: 'novel character links',
    sources: ['characters']
  },
  characterPerson: {
    surface: 'characterPerson',
    label: 'character person links',
    sources: ['characterPersons'],
    // Knowledge layer; see `GAME_LINK_TOPOLOGY.characterPerson`.
    mergeOnly: true
  }
}

type CharacterRelationFactSource = 'cast'

const CHARACTER_FACT_SOURCE_ANSWERED: Record<
  CharacterRelationFactSource,
  (facts: ScrapedCharacterRelationFacts) => boolean
> = {
  cast: (facts) => facts.characterPerson !== undefined
}

export const CHARACTER_LINK_TOPOLOGY: Record<
  CharacterLinkKind,
  LinkTopologySpec<CharacterUpdateRelationSurface, CharacterRelationFactSource>
> = {
  characterPerson: {
    surface: 'person',
    label: 'character person links',
    sources: ['cast'],
    // Knowledge layer; see `GAME_LINK_TOPOLOGY.characterPerson`. Scraping the
    // character directly is still one source's answer, so it may not delete
    // either — removing a row stays a user or entity-merge decision.
    mergeOnly: true
  }
}

/** Collects the link tables whose every fact source answered. */
function collectCompleteLinks<
  TSurface extends string,
  TFactSource extends string,
  TLinkKind extends string,
  TFacts
>(
  topology: Record<TLinkKind, LinkTopologySpec<TSurface, TFactSource>>,
  answered: Record<TFactSource, (facts: TFacts) => boolean>,
  facts: TFacts
): Set<TLinkKind> {
  const complete = new Set<TLinkKind>()

  for (const kind of Object.keys(topology) as TLinkKind[]) {
    if (topology[kind].sources.every((source) => answered[source](facts))) complete.add(kind)
  }

  return complete
}

export function buildCompleteGameLinks(facts: ScrapedGameRelationFacts): Set<GameLinkKind> {
  return collectCompleteLinks(GAME_LINK_TOPOLOGY, GAME_FACT_SOURCE_ANSWERED, facts)
}

export function buildCompleteAnimeLinks(facts: ScrapedAnimeRelationFacts): Set<AnimeLinkKind> {
  return collectCompleteLinks(ANIME_LINK_TOPOLOGY, ANIME_FACT_SOURCE_ANSWERED, facts)
}

export function buildCompleteComicLinks(facts: ScrapedComicRelationFacts): Set<ComicLinkKind> {
  return collectCompleteLinks(COMIC_LINK_TOPOLOGY, COMIC_FACT_SOURCE_ANSWERED, facts)
}

export function buildCompleteNovelLinks(facts: ScrapedNovelRelationFacts): Set<NovelLinkKind> {
  return collectCompleteLinks(NOVEL_LINK_TOPOLOGY, NOVEL_FACT_SOURCE_ANSWERED, facts)
}

export function buildCompleteCharacterLinks(
  facts: ScrapedCharacterRelationFacts
): Set<CharacterLinkKind> {
  return collectCompleteLinks(CHARACTER_LINK_TOPOLOGY, CHARACTER_FACT_SOURCE_ANSWERED, facts)
}

export interface ResolvedLinkWrites<TLinkKind extends string> {
  /** Link tables to write, each with the mode resolved for that table. */
  links: Partial<Record<TLinkKind, CollectionUpdateMode>>
  /** Link tables where the requested `replace` was downgraded to `merge`. */
  degraded: TLinkKind[]
}

/**
 * Resolves which link tables to write and with which mode.
 *
 * A table is written when its surface was selected and answered. Replace also
 * requires every feeding source to have answered; otherwise it downgrades to
 * merge, because deleting rows the scrape was never asked about would drop data
 * no source contradicted. Merge-only tables never resolve to replace at all.
 */
export function resolveLinkWrites<
  TSurface extends string,
  TFactSource extends string,
  TLinkKind extends string
>(params: {
  topology: Record<TLinkKind, LinkTopologySpec<TSurface, TFactSource>>
  selectedSurfaces: readonly TSurface[]
  availability: UpdateIncomingRelationAvailability<TSurface, TLinkKind>
  mode: CollectionUpdateMode
}): ResolvedLinkWrites<TLinkKind> {
  const { topology, selectedSurfaces, availability, mode } = params
  const resolved: Partial<Record<TLinkKind, CollectionUpdateMode>> = {}
  const degraded: TLinkKind[] = []

  for (const kind of Object.keys(topology) as TLinkKind[]) {
    const { surface, mergeOnly } = topology[kind]
    if (!selectedSurfaces.includes(surface)) continue
    if (!availability.surfaces.has(surface)) continue

    if (mergeOnly) {
      resolved[kind] = 'merge'
      continue
    }

    const downgraded = mode === 'replace' && !availability.completeLinks.has(kind)
    resolved[kind] = downgraded ? 'merge' : mode
    if (downgraded) degraded.push(kind)
  }

  return { links: resolved, degraded }
}

/**
 * Reports downgraded replaces that actually preserved rows.
 *
 * A downgrade that kept nothing is invisible to the user, so it stays silent.
 */
export function createLinkDegradeWarnings<
  TSurface extends string,
  TFactSource extends string,
  TLinkKind extends string
>(params: {
  topology: Record<TLinkKind, LinkTopologySpec<TSurface, TFactSource>>
  degraded: readonly TLinkKind[]
  preservedRows: Partial<Record<TLinkKind, number>>
}): IngestWarning[] {
  const { topology, degraded, preservedRows } = params

  return degraded.flatMap((kind) => {
    const preserved = preservedRows[kind] ?? 0
    if (preserved === 0) return []

    return [
      {
        code: 'collection-replace-degraded' as const,
        message: `Replace fell back to merge for ${topology[kind].label}: kept ${preserved} stored rows because the scrape did not answer every source feeding them.`
      }
    ]
  })
}
