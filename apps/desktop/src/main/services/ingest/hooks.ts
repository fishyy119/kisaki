/**
 * Ingest module hook points.
 *
 * Owned by IngestService and dispatched by the add/update handlers around their
 * write transactions: veto hooks run before the persist transaction starts,
 * notify hooks run after it commits.
 */

import { createNotifyHook, createVetoHook, type NotifyHook, type VetoHook } from '@main/hooks'
import type { ExternalId } from '@shared/identity'
import type { IngestWarning } from '@shared/ingest'

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

export interface IngestEntityHooks {
  /** Gatekeeps an add persist; a veto aborts the ingest before any write. */
  committing: VetoHook<IngestCommittingPayload>
  /** Fires after an add persist transaction commits. */
  committed: NotifyHook<IngestCommittedPayload>
  /** Gatekeeps an update apply; a veto aborts the update before any write. */
  updating: VetoHook<IngestUpdatingPayload>
  /** Fires after an update apply transaction commits. */
  updated: NotifyHook<IngestUpdatedPayload>
}

export interface IngestHooks {
  game: IngestEntityHooks
  anime: IngestEntityHooks
  person: IngestEntityHooks
  company: IngestEntityHooks
  character: IngestEntityHooks
}

export function createIngestHooks(): IngestHooks {
  return {
    game: createIngestEntityHooks('ingest.game'),
    anime: createIngestEntityHooks('ingest.anime'),
    person: createIngestEntityHooks('ingest.person'),
    company: createIngestEntityHooks('ingest.company'),
    character: createIngestEntityHooks('ingest.character')
  }
}

function createIngestEntityHooks(prefix: string): IngestEntityHooks {
  return {
    committing: createVetoHook<IngestCommittingPayload>(`${prefix}.committing`),
    committed: createNotifyHook<IngestCommittedPayload>(`${prefix}.committed`),
    updating: createVetoHook<IngestUpdatingPayload>(`${prefix}.updating`),
    updated: createNotifyHook<IngestUpdatedPayload>(`${prefix}.updated`)
  }
}

/** Throws the stable ingest veto error when a committing/updating hook vetoes. */
export async function requireIngestAllowed<TPayload>(
  hook: VetoHook<TPayload>,
  payload: TPayload
): Promise<void> {
  const veto = await hook.dispatch(payload)
  if (veto) {
    throw new Error('Ingest was cancelled by an extension hook.')
  }
}
