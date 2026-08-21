/**
 * Company relation vocabulary.
 *
 * Company relations are directed edges between companies stored in the
 * `company_relations` table. They follow the media relation doctrine — rows are
 * stored exactly as written and readers merge both directions through the total
 * inverse map — but both endpoints are real foreign keys, so referential
 * integrity is the database's job rather than an application choke point.
 *
 * The vocabulary states corporate structure and lineage: which label belongs to
 * which house, and how a house became another one.
 */

export const COMPANY_RELATION_TYPES = [
  'parent',
  'subsidiary',
  'brand',
  'brandOwner',
  'renamedTo',
  'renamedFrom',
  'spinOff',
  'spinOffOrigin',
  'other'
] as const

export type CompanyRelationType = (typeof COMPANY_RELATION_TYPES)[number]

/** Label used when an edge is read from its target side; total by construction. */
export const COMPANY_RELATION_TYPE_INVERSE: Record<CompanyRelationType, CompanyRelationType> = {
  parent: 'subsidiary',
  subsidiary: 'parent',
  brand: 'brandOwner',
  brandOwner: 'brand',
  renamedTo: 'renamedFrom',
  renamedFrom: 'renamedTo',
  spinOff: 'spinOffOrigin',
  spinOffOrigin: 'spinOff',
  other: 'other'
}
