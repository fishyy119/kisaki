import type { IngestHooks } from '@main/services/ingest/hooks'
import type { ExtensionHookContributionPoint } from '../point'

/** Binds ingest module hooks to their public hook points. */
export function bindIngestHookPoints(
  ingest: IngestHooks,
  point: ExtensionHookContributionPoint
): void {
  ingest.game.committing.tap(
    async (p) => (await point.veto('ingest.game.committing', p)) ?? undefined
  )
  ingest.game.committed.tap((p) => point.notify('ingest.game.committed', p))
  ingest.game.updating.tap(async (p) => (await point.veto('ingest.game.updating', p)) ?? undefined)
  ingest.game.updated.tap((p) => point.notify('ingest.game.updated', p))
  ingest.anime.committing.tap(
    async (p) => (await point.veto('ingest.anime.committing', p)) ?? undefined
  )
  ingest.anime.committed.tap((p) => point.notify('ingest.anime.committed', p))
  ingest.comic.committing.tap(
    async (p) => (await point.veto('ingest.comic.committing', p)) ?? undefined
  )
  ingest.comic.committed.tap((p) => point.notify('ingest.comic.committed', p))
  ingest.comic.updating.tap(
    async (p) => (await point.veto('ingest.comic.updating', p)) ?? undefined
  )
  ingest.comic.updated.tap((p) => point.notify('ingest.comic.updated', p))
  ingest.novel.committing.tap(
    async (p) => (await point.veto('ingest.novel.committing', p)) ?? undefined
  )
  ingest.novel.committed.tap((p) => point.notify('ingest.novel.committed', p))
  ingest.novel.updating.tap(
    async (p) => (await point.veto('ingest.novel.updating', p)) ?? undefined
  )
  ingest.novel.updated.tap((p) => point.notify('ingest.novel.updated', p))
  ingest.person.committing.tap(
    async (p) => (await point.veto('ingest.person.committing', p)) ?? undefined
  )
  ingest.person.committed.tap((p) => point.notify('ingest.person.committed', p))
  ingest.person.updating.tap(
    async (p) => (await point.veto('ingest.person.updating', p)) ?? undefined
  )
  ingest.person.updated.tap((p) => point.notify('ingest.person.updated', p))
  ingest.company.committing.tap(
    async (p) => (await point.veto('ingest.company.committing', p)) ?? undefined
  )
  ingest.company.committed.tap((p) => point.notify('ingest.company.committed', p))
  ingest.company.updating.tap(
    async (p) => (await point.veto('ingest.company.updating', p)) ?? undefined
  )
  ingest.company.updated.tap((p) => point.notify('ingest.company.updated', p))
  ingest.character.committing.tap(
    async (p) => (await point.veto('ingest.character.committing', p)) ?? undefined
  )
  ingest.character.committed.tap((p) => point.notify('ingest.character.committed', p))
  ingest.character.updating.tap(
    async (p) => (await point.veto('ingest.character.updating', p)) ?? undefined
  )
  ingest.character.updated.tap((p) => point.notify('ingest.character.updated', p))
}
