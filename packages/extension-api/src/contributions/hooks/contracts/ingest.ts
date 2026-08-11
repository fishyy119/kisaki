import type { IngestWarning } from '../../../capabilities/ingest'
import type { ExternalId } from '../../../shared'
import type { HookPointSpec } from './point'

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
 * Ingest hook points.
 *
 * `committing`/`updating` are veto points dispatched before the persist
 * transaction; `committed`/`updated` are notify points fired after commit.
 */
export interface IngestHookPoints {
  'ingest.game.committing': HookPointSpec<'veto', IngestCommittingPayload>
  'ingest.game.committed': HookPointSpec<'notify', IngestCommittedPayload>
  'ingest.game.updating': HookPointSpec<'veto', IngestUpdatingPayload>
  'ingest.game.updated': HookPointSpec<'notify', IngestUpdatedPayload>
  /** Anime ingest currently supports add only, so it has no update points. */
  'ingest.anime.committing': HookPointSpec<'veto', IngestCommittingPayload>
  'ingest.anime.committed': HookPointSpec<'notify', IngestCommittedPayload>
  'ingest.person.committing': HookPointSpec<'veto', IngestCommittingPayload>
  'ingest.person.committed': HookPointSpec<'notify', IngestCommittedPayload>
  'ingest.person.updating': HookPointSpec<'veto', IngestUpdatingPayload>
  'ingest.person.updated': HookPointSpec<'notify', IngestUpdatedPayload>
  'ingest.company.committing': HookPointSpec<'veto', IngestCommittingPayload>
  'ingest.company.committed': HookPointSpec<'notify', IngestCommittedPayload>
  'ingest.company.updating': HookPointSpec<'veto', IngestUpdatingPayload>
  'ingest.company.updated': HookPointSpec<'notify', IngestUpdatedPayload>
  'ingest.character.committing': HookPointSpec<'veto', IngestCommittingPayload>
  'ingest.character.committed': HookPointSpec<'notify', IngestCommittedPayload>
  'ingest.character.updating': HookPointSpec<'veto', IngestUpdatingPayload>
  'ingest.character.updated': HookPointSpec<'notify', IngestUpdatedPayload>
}
