import { LIBRARY_CONTENT_ENTITY_TYPES } from '../../capabilities/library/entities'
import type { Disposable } from '../../shared'
import {
  ACTIVITY_SESSION_HOOK_KIND,
  listActivitySessionPointIds,
  type ActivityHookPoints
} from './contracts/activity'
import type { AppHookPoints } from './contracts/app'
import type { ExtensionHookLifecyclePoints } from './contracts/extension'
import { INGEST_HOOK_EDGE_KINDS, type IngestHookPoints } from './contracts/ingest'
import type { LibraryHookPoints } from './contracts/library'
import type { ScannerHookPoints } from './contracts/scanner'
import { SCRAPER_HOOK_EDGE_KINDS, type ScraperHookPoints } from './contracts/scraper'
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
  ActivityHookPoints &
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
  await?: boolean | undefined
}

/**
 * Descriptors for one `<root>.<entity>.<edge>` family, generated from the
 * entity constants so the runtime catalog can never miss an entity the type
 * map declares.
 */
function entityFamilyDescriptors<
  TRoot extends string,
  TEntity extends string,
  TEdge extends string
>(
  root: TRoot,
  entities: readonly TEntity[],
  edgeKinds: Record<TEdge, HookKind>
): Record<`${TRoot}.${TEntity}.${TEdge}`, ExtensionHookPointDescriptor> {
  const descriptors: Record<string, ExtensionHookPointDescriptor> = {}
  for (const entity of entities) {
    for (const edge of Object.keys(edgeKinds) as TEdge[]) {
      descriptors[`${root}.${entity}.${edge}`] = { kind: edgeKinds[edge] }
    }
  }
  // The id grammar lives in the return type; the loop mirrors it segment for segment.
  return descriptors as Record<`${TRoot}.${TEntity}.${TEdge}`, ExtensionHookPointDescriptor>
}

function activitySessionDescriptors(): Record<
  ReturnType<typeof listActivitySessionPointIds>[number],
  ExtensionHookPointDescriptor
> {
  const descriptors: Record<string, ExtensionHookPointDescriptor> = {}
  for (const id of listActivitySessionPointIds()) {
    descriptors[id] = { kind: ACTIVITY_SESSION_HOOK_KIND }
  }
  return descriptors as Record<
    ReturnType<typeof listActivitySessionPointIds>[number],
    ExtensionHookPointDescriptor
  >
}

/** Runtime catalog of every hook point, for validation and kind dispatch. */
export const EXTENSION_HOOK_POINTS = {
  ...entityFamilyDescriptors('scraper', LIBRARY_CONTENT_ENTITY_TYPES, SCRAPER_HOOK_EDGE_KINDS),
  ...entityFamilyDescriptors('ingest', LIBRARY_CONTENT_ENTITY_TYPES, INGEST_HOOK_EDGE_KINDS),
  ...activitySessionDescriptors(),
  'activity.game.launching': { kind: 'waterfall' },
  'activity.game.play.ending': { kind: 'waterfall' },
  'scanner.entry.discovered': { kind: 'waterfall' },
  'scanner.entry.matched': { kind: 'waterfall' },
  'scanner.run.started': { kind: 'notify' },
  'scanner.run.finished': { kind: 'notify' },
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
} satisfies Record<ExtensionHookPointId, ExtensionHookPointDescriptor>

export interface HookTapOptions {
  /** Ascending dispatch order; equal priorities keep registration order. */
  priority?: number | undefined
}

/** Registration surface exposed to extensions as `context.hooks`. */
export interface HooksRegistrar {
  on<TPoint extends ExtensionHookPointId>(
    pointId: TPoint,
    handler: ExtensionHookHandler<TPoint>,
    options?: HookTapOptions | undefined
  ): Disposable
}
