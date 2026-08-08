/**
 * Relation link topology for metadata updates.
 *
 * Each link table is declared once with the surface that owns it and the fact
 * sources that feed it. Writing a table needs its surface answered; clearing it
 * needs every source answered, so `replace` degrades to `merge` when the scrape
 * could not speak for one of them.
 *
 * Link keys come from the graph builder's output, so a new link table cannot be
 * added without declaring its surface and sources here. Adding another source to
 * an existing table is not compiler-checked: keep `sources` in step with the
 * graph builders in `../graph`.
 */

import type { IngestWarning } from '@shared/ingest'
import type {
  CharacterUpdateRelationSurface,
  GameUpdateRelationSurface
} from '@shared/ingest/update'
import type { ScrapedCharacterRelationFacts, ScrapedGameRelationFacts } from '@shared/scraper'
import type {
  CharacterRelationLink,
  CollectionUpdateMode,
  GameRelationLink,
  UpdateIncomingRelationAvailability
} from './types'

interface RelationLinkSpec<TSurface extends string, TFactSource extends string> {
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

export const GAME_RELATION_LINKS: Record<
  GameRelationLink,
  RelationLinkSpec<GameUpdateRelationSurface, GameRelationFactSource>
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

type CharacterRelationFactSource = 'cast'

const CHARACTER_FACT_SOURCE_ANSWERED: Record<
  CharacterRelationFactSource,
  (facts: ScrapedCharacterRelationFacts) => boolean
> = {
  cast: (facts) => facts.characterPerson !== undefined
}

export const CHARACTER_RELATION_LINKS: Record<
  CharacterRelationLink,
  RelationLinkSpec<CharacterUpdateRelationSurface, CharacterRelationFactSource>
> = {
  characterPerson: {
    surface: 'person',
    label: 'character person links',
    sources: ['cast']
  }
}

/** Collects the link tables whose every fact source answered. */
function buildCompleteLinks<
  TSurface extends string,
  TFactSource extends string,
  TRelationLink extends string,
  TFacts
>(
  links: Record<TRelationLink, RelationLinkSpec<TSurface, TFactSource>>,
  answered: Record<TFactSource, (facts: TFacts) => boolean>,
  facts: TFacts
): Set<TRelationLink> {
  const complete = new Set<TRelationLink>()

  for (const link of Object.keys(links) as TRelationLink[]) {
    if (links[link].sources.every((source) => answered[source](facts))) complete.add(link)
  }

  return complete
}

export function buildCompleteGameRelationLinks(
  facts: ScrapedGameRelationFacts
): Set<GameRelationLink> {
  return buildCompleteLinks(GAME_RELATION_LINKS, GAME_FACT_SOURCE_ANSWERED, facts)
}

export function buildCompleteCharacterRelationLinks(
  facts: ScrapedCharacterRelationFacts
): Set<CharacterRelationLink> {
  return buildCompleteLinks(CHARACTER_RELATION_LINKS, CHARACTER_FACT_SOURCE_ANSWERED, facts)
}

export interface ResolvedRelationLinks<TRelationLink extends string> {
  /** Link tables to write, each with the mode resolved for that table. */
  links: Partial<Record<TRelationLink, CollectionUpdateMode>>
  /** Link tables where the requested `replace` was downgraded to `merge`. */
  degraded: TRelationLink[]
}

/**
 * Resolves which link tables to write and with which mode.
 *
 * A table is written when its surface was selected and answered. Replace also
 * requires every feeding source to have answered; otherwise it downgrades to
 * merge, because deleting rows the scrape was never asked about would drop data
 * no source contradicted.
 */
export function resolveRelationLinks<
  TSurface extends string,
  TFactSource extends string,
  TRelationLink extends string
>(params: {
  links: Record<TRelationLink, RelationLinkSpec<TSurface, TFactSource>>
  selectedSurfaces: readonly TSurface[]
  availability: UpdateIncomingRelationAvailability<TSurface, TRelationLink>
  mode: CollectionUpdateMode
}): ResolvedRelationLinks<TRelationLink> {
  const { links, selectedSurfaces, availability, mode } = params
  const resolved: Partial<Record<TRelationLink, CollectionUpdateMode>> = {}
  const degraded: TRelationLink[] = []

  for (const link of Object.keys(links) as TRelationLink[]) {
    const { surface } = links[link]
    if (!selectedSurfaces.includes(surface)) continue
    if (!availability.surfaces.has(surface)) continue

    const downgraded = mode === 'replace' && !availability.completeRelationLinks.has(link)
    resolved[link] = downgraded ? 'merge' : mode
    if (downgraded) degraded.push(link)
  }

  return { links: resolved, degraded }
}

/**
 * Reports downgraded replaces that actually preserved rows.
 *
 * A downgrade that kept nothing is invisible to the user, so it stays silent.
 */
export function createRelationDegradeWarnings<
  TSurface extends string,
  TFactSource extends string,
  TRelationLink extends string
>(params: {
  links: Record<TRelationLink, RelationLinkSpec<TSurface, TFactSource>>
  degraded: readonly TRelationLink[]
  preservedRows: Partial<Record<TRelationLink, number>>
}): IngestWarning[] {
  const { links, degraded, preservedRows } = params

  return degraded.flatMap((link) => {
    const preserved = preservedRows[link] ?? 0
    if (preserved === 0) return []

    return [
      {
        code: 'collection-replace-degraded' as const,
        message: `Replace fell back to merge for ${links[link].label}: kept ${preserved} stored rows because the scrape did not answer every source feeding them.`
      }
    ]
  })
}
