/**
 * Link-table topology for metadata updates.
 *
 * Each link table is declared once with the surface that owns it and the fact
 * sources that feed it. Writing a table needs its surface answered; clearing it
 * needs every source answered, so `replace` degrades to `merge` when the scrape
 * could not speak for one of them.
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
  GameUpdateRelationSurface
} from '@shared/ingest/update'
import type {
  ScrapedAnimeRelationFacts,
  ScrapedCharacterRelationFacts,
  ScrapedGameRelationFacts
} from '@shared/scraper'
import type {
  AnimeLinkKind,
  CharacterLinkKind,
  CollectionUpdateMode,
  GameLinkKind,
  UpdateIncomingRelationAvailability
} from './types'

interface LinkTopologySpec<TSurface extends string, TFactSource extends string> {
  /** Update surface that selects this link table. */
  surface: TSurface
  /** Stable English noun used when reporting a downgraded replace. */
  label: string
  /** Fact sources that contribute rows; all must answer before rows may be deleted. */
  sources: readonly TFactSource[]
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
  characterPerson: {
    surface: 'characterPerson',
    label: 'character person links',
    sources: ['cast']
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
  characterPerson: {
    surface: 'characterPerson',
    label: 'character person links',
    sources: ['cast']
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
    sources: ['cast']
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
 * no source contradicted.
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
    const { surface } = topology[kind]
    if (!selectedSurfaces.includes(surface)) continue
    if (!availability.surfaces.has(surface)) continue

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
