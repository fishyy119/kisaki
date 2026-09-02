import type { IngestWarning } from '../../../capabilities/ingest'
import type { LibraryContentEntityType } from '../../../capabilities/library/entities'
import type { ExternalId } from '../../../shared'
import type { HookKind, HookPointSpec } from './point'

export interface IngestCommittingPayload {
  name: string
  externalIds: readonly ExternalId[]
}

export interface IngestCommittedPayload {
  entityId: string
  isNew: boolean
  warnings: readonly IngestWarning[]
}

export interface IngestUpdatingPayload {
  entityId: string
  name: string
  surfaces: readonly string[]
  externalIds: readonly ExternalId[]
}

export interface IngestUpdatedPayload {
  entityId: string
  surfaces: readonly string[]
  warnings: readonly IngestWarning[]
}

/**
 * The four ingest edges every content entity type reports, with their kinds.
 * `committing` / `updating` are veto points dispatched before the persist
 * transaction; `committed` / `updated` are notify points fired after commit.
 */
export const INGEST_HOOK_EDGE_KINDS = {
  committing: 'veto',
  committed: 'notify',
  updating: 'veto',
  updated: 'notify'
} as const satisfies Record<string, HookKind>

export type IngestHookEdge = keyof typeof INGEST_HOOK_EDGE_KINDS

interface IngestEdgeSpecs {
  committing: HookPointSpec<'veto', IngestCommittingPayload>
  committed: HookPointSpec<'notify', IngestCommittedPayload>
  updating: HookPointSpec<'veto', IngestUpdatingPayload>
  updated: HookPointSpec<'notify', IngestUpdatedPayload>
}

export type IngestHookPointId = `ingest.${LibraryContentEntityType}.${IngestHookEdge}`

/**
 * Ingest hook points: one full edge set per content entity type, derived from
 * the entity union so no type can silently miss an edge.
 */
export type IngestHookPoints = {
  [TId in IngestHookPointId]: TId extends `ingest.${string}.${infer TEdge extends IngestHookEdge}`
    ? IngestEdgeSpecs[TEdge]
    : never
}
