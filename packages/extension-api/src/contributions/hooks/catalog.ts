import type { Disposable } from '../../shared'
import type { AppHookPoints } from './contracts/app'
import type { ExtensionHookLifecyclePoints } from './contracts/extension'
import type { IngestHookPoints } from './contracts/ingest'
import type { LibraryHookPoints } from './contracts/library'
import type { PlayHookPoints } from './contracts/play'
import type { ScannerHookPoints } from './contracts/scanner'
import type { ScraperHookPoints } from './contracts/scraper'
import type {
  HookKind,
  NotifyHookPointHandler,
  VetoHookPointHandler,
  WaterfallHookPointHandler
} from './contracts/point'

/**
 * The complete hook point map: public point id -> kind + payload contract.
 *
 * Hook points only expose workflow boundaries - input data, decisions, and
 * results. Internal intermediate representations are never hook points.
 */
export type ExtensionHookPoints = ScraperHookPoints &
  IngestHookPoints &
  ScannerHookPoints &
  PlayHookPoints &
  LibraryHookPoints &
  AppHookPoints &
  ExtensionHookLifecyclePoints

export type ExtensionHookPointId = Extract<keyof ExtensionHookPoints, string>

export type ExtensionHookKind<TPoint extends ExtensionHookPointId> =
  ExtensionHookPoints[TPoint]['kind']

export type ExtensionHookPayload<TPoint extends ExtensionHookPointId> =
  ExtensionHookPoints[TPoint]['payload']

export type ExtensionHookHandler<TPoint extends ExtensionHookPointId> =
  ExtensionHookKind<TPoint> extends 'waterfall'
    ? WaterfallHookPointHandler<ExtensionHookPayload<TPoint>>
    : ExtensionHookKind<TPoint> extends 'veto'
      ? VetoHookPointHandler<ExtensionHookPayload<TPoint>>
      : NotifyHookPointHandler<ExtensionHookPayload<TPoint>>

export interface ExtensionHookPointDescriptor {
  kind: HookKind
  /** Notify points the dispatching workflow awaits within a bounded budget. */
  await?: boolean
}

/** Runtime catalog of every hook point, for validation and kind dispatch. */
export const EXTENSION_HOOK_POINTS = {
  'scraper.game.lookup': { kind: 'waterfall' },
  'scraper.game.searched': { kind: 'waterfall' },
  'scraper.game.collected': { kind: 'waterfall' },
  'scraper.anime.lookup': { kind: 'waterfall' },
  'scraper.anime.searched': { kind: 'waterfall' },
  'scraper.anime.collected': { kind: 'waterfall' },
  'scraper.comic.lookup': { kind: 'waterfall' },
  'scraper.comic.searched': { kind: 'waterfall' },
  'scraper.comic.collected': { kind: 'waterfall' },
  'scraper.novel.lookup': { kind: 'waterfall' },
  'scraper.novel.searched': { kind: 'waterfall' },
  'scraper.novel.collected': { kind: 'waterfall' },
  'scraper.person.lookup': { kind: 'waterfall' },
  'scraper.person.searched': { kind: 'waterfall' },
  'scraper.person.collected': { kind: 'waterfall' },
  'scraper.company.lookup': { kind: 'waterfall' },
  'scraper.company.searched': { kind: 'waterfall' },
  'scraper.company.collected': { kind: 'waterfall' },
  'scraper.character.lookup': { kind: 'waterfall' },
  'scraper.character.searched': { kind: 'waterfall' },
  'scraper.character.collected': { kind: 'waterfall' },
  'ingest.game.committing': { kind: 'veto' },
  'ingest.game.committed': { kind: 'notify' },
  'ingest.game.updating': { kind: 'veto' },
  'ingest.game.updated': { kind: 'notify' },
  'ingest.anime.committing': { kind: 'veto' },
  'ingest.anime.committed': { kind: 'notify' },
  'ingest.comic.committing': { kind: 'veto' },
  'ingest.comic.committed': { kind: 'notify' },
  'ingest.comic.updating': { kind: 'veto' },
  'ingest.comic.updated': { kind: 'notify' },
  'ingest.novel.committing': { kind: 'veto' },
  'ingest.novel.committed': { kind: 'notify' },
  'ingest.novel.updating': { kind: 'veto' },
  'ingest.novel.updated': { kind: 'notify' },
  'ingest.person.committing': { kind: 'veto' },
  'ingest.person.committed': { kind: 'notify' },
  'ingest.person.updating': { kind: 'veto' },
  'ingest.person.updated': { kind: 'notify' },
  'ingest.company.committing': { kind: 'veto' },
  'ingest.company.committed': { kind: 'notify' },
  'ingest.company.updating': { kind: 'veto' },
  'ingest.company.updated': { kind: 'notify' },
  'ingest.character.committing': { kind: 'veto' },
  'ingest.character.committed': { kind: 'notify' },
  'ingest.character.updating': { kind: 'veto' },
  'ingest.character.updated': { kind: 'notify' },
  'scanner.entry.discovered': { kind: 'waterfall' },
  'scanner.entry.matched': { kind: 'waterfall' },
  'scanner.run.started': { kind: 'notify' },
  'scanner.run.finished': { kind: 'notify' },
  'play.game.launching': { kind: 'waterfall' },
  'play.game.session.started': { kind: 'notify' },
  'play.game.session.ending': { kind: 'waterfall' },
  'play.game.session.ended': { kind: 'notify' },
  'play.anime.watch.started': { kind: 'notify' },
  'play.anime.watch.ended': { kind: 'notify' },
  'play.comic.read.started': { kind: 'notify' },
  'play.comic.read.ended': { kind: 'notify' },
  'play.novel.read.started': { kind: 'notify' },
  'play.novel.read.ended': { kind: 'notify' },
  'library.changed': { kind: 'notify' },
  'library.entity-merging': { kind: 'veto' },
  'library.entity-merged': { kind: 'notify' },
  'app.ready': { kind: 'notify' },
  'app.shutting-down': { kind: 'notify', await: true },
  'app.settings.changed': { kind: 'notify' },
  'app.ui-locale.changed': { kind: 'notify' },
  'app.theme.changed': { kind: 'notify' },
  'extension.enabled': { kind: 'notify' },
  'extension.disabled': { kind: 'notify' }
} as const satisfies Record<ExtensionHookPointId, ExtensionHookPointDescriptor>

export interface HookTapOptions {
  /** Ascending dispatch order; equal priorities keep registration order. */
  priority?: number
}

/** Registration surface exposed to extensions as `context.hooks`. */
export interface HooksRegistrar {
  on<TPoint extends ExtensionHookPointId>(
    pointId: TPoint,
    handler: ExtensionHookHandler<TPoint>,
    options?: HookTapOptions
  ): Disposable
}
