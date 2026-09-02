/**
 * Media relation vocabulary.
 *
 * Media relations are directed edges between media entries stored in the
 * polymorphic `media_relations` table. A row `(from -> to, type)` reads as
 * "`to` is the `type` of `from`": `(A -> B, sequel)` states that B is the
 * sequel of A. Each row is the `from` entry's own assertion (a scrape writes
 * an entry's out-edges; the editor rewrites them); readers merge both
 * directions and label incoming edges through the inverse map, so a fact
 * asserted by either endpoint is visible from both.
 *
 * A concept becomes a kind only when it is pairwise (group facts such as a
 * shared setting or a franchise are n-ary and belong in a collection), not
 * derivable from the rest of the graph (a shared cast is already encoded by
 * two entries linking the same character), has a closed, labelable, involutive
 * meaning, and is published structurally by at least one source. Every kind
 * is medium-neutral; medium-specific forms (fandisc, DLC, remaster, coloured
 * edition) fold into a kind and keep the source's word in `note`.
 */

import type { MediaType } from '../../entity-types'

/**
 * Directed kinds as `[type, inverse]` pairs. Each pair is one axis of
 * derivation: continuation, supplementary story, spin-off, condensation,
 * transposition into another medium or format, and aggregation.
 */
export const MEDIA_RELATION_DIRECTED_PAIRS = [
  ['sequel', 'prequel'],
  ['sideStory', 'mainStory'],
  ['spinOff', 'spinOffOrigin'],
  ['summary', 'fullStory'],
  ['adaptation', 'sourceMaterial'],
  ['compilation', 'includedWork']
] as const

/**
 * Kinds that read the same from either endpoint. `crossMedia` is the
 * transposition axis with the derivation direction unstated: sources that
 * publish "the same work in another medium" without saying which came first
 * state exactly this, and inventing a direction from release dates would be
 * wrong for the promotional comics that open alongside an original anime.
 */
export const MEDIA_RELATION_SYMMETRIC_TYPES = ['alternativeVersion', 'crossMedia', 'other'] as const

export type MediaRelationType =
  | (typeof MEDIA_RELATION_DIRECTED_PAIRS)[number][number]
  | (typeof MEDIA_RELATION_SYMMETRIC_TYPES)[number]

/** Every kind, pairs first in declaration order; this order is the UI group order. */
export const MEDIA_RELATION_TYPES: readonly MediaRelationType[] = [
  ...MEDIA_RELATION_DIRECTED_PAIRS.flat(),
  ...MEDIA_RELATION_SYMMETRIC_TYPES
]

/**
 * Label used when an edge is read from its target side.
 *
 * Derived from the pair declaration, so it is total and an involution by
 * construction: no hand-written entry can drift from its partner.
 */
export const MEDIA_RELATION_TYPE_INVERSE: Readonly<Record<MediaRelationType, MediaRelationType>> =
  // The cast is the single point where the pair list becomes a keyed record;
  // every key is written exactly once by the two loops below.
  Object.fromEntries([
    ...MEDIA_RELATION_DIRECTED_PAIRS.flatMap(([type, inverse]) => [
      [type, inverse],
      [inverse, type]
    ]),
    ...MEDIA_RELATION_SYMMETRIC_TYPES.map((type) => [type, type])
  ]) as Record<MediaRelationType, MediaRelationType>

/**
 * Kinds that state a change of medium and therefore cannot join two entries
 * of one media type. This is the only endpoint constraint: every other kind
 * is medium-neutral (a web novel is the source material of its light novel,
 * a novel is the prequel of a game), so the vocabulary is not narrowed by
 * the endpoint pair.
 */
const CROSS_MEDIA_ONLY_TYPES: ReadonlySet<MediaRelationType> = new Set<MediaRelationType>([
  'crossMedia'
])

/** Whether `type` may label a directed edge from `fromType` to `toType`. */
export function isMediaRelationTypeAllowed(
  type: MediaRelationType,
  fromType: MediaType,
  toType: MediaType
): boolean {
  return fromType !== toType || !CROSS_MEDIA_ONLY_TYPES.has(type)
}

/** Kinds allowed on a directed edge from `fromType` to `toType`, in vocabulary order. */
export function listMediaRelationTypes(
  fromType: MediaType,
  toType: MediaType
): readonly MediaRelationType[] {
  return MEDIA_RELATION_TYPES.filter((type) => isMediaRelationTypeAllowed(type, fromType, toType))
}

/**
 * Kinds made redundant by a more specific kind on the same pair.
 *
 * `crossMedia` is the undirected form of the transposition axis, so once a
 * source states the direction the undirected edge says nothing more. Readers
 * apply this after inverse labelling, so a directed edge stored on either
 * endpoint subsumes the undirected one.
 */
export const MEDIA_RELATION_TYPE_SUBSUMED_BY: Partial<
  Record<MediaRelationType, readonly MediaRelationType[]>
> = {
  crossMedia: ['adaptation', 'sourceMaterial']
}

export interface MediaRelationEdgeView {
  type: MediaRelationType
  targetType: MediaType
  targetId: string
}

/**
 * Drops edges whose kind is subsumed by another edge to the same target.
 * @param read - Projects an edge onto its kind and target as seen from the entry being read.
 */
export function collapseSubsumedMediaRelations<T>(
  edges: readonly T[],
  read: (edge: T) => MediaRelationEdgeView
): T[] {
  const typesByTarget = new Map<string, Set<MediaRelationType>>()
  for (const edge of edges) {
    const view = read(edge)
    const key = targetKey(view)
    const types = typesByTarget.get(key) ?? new Set<MediaRelationType>()
    types.add(view.type)
    typesByTarget.set(key, types)
  }

  return edges.filter((edge) => {
    const view = read(edge)
    const refinements = MEDIA_RELATION_TYPE_SUBSUMED_BY[view.type]
    if (!refinements) return true
    const types = typesByTarget.get(targetKey(view))!
    return !refinements.some((refinement) => types.has(refinement))
  })
}

function targetKey(view: MediaRelationEdgeView): string {
  return `${view.targetType}\0${view.targetId}`
}
