import type { MaybePromise } from '../../../shared'

/**
 * Hook kinds.
 *
 * - `notify`: after-the-fact notification; handlers never affect the workflow.
 *   Points marked `await: true` are awaited by the host workflow within a
 *   bounded budget (currently only `app.shutting-down`).
 * - `waterfall`: ordered value transformation; a failing handler is skipped
 *   and the previous value is kept.
 * - `veto`: ordered gatekeeping before a write; the first handler returning a
 *   veto aborts the workflow, and a failing handler counts as "no veto".
 */
export type HookKind = 'notify' | 'waterfall' | 'veto'

/** Result a veto hook handler returns to abort the gated workflow. */
export interface HookVeto {
  veto: true
  reason?: string
}

/** Declarative shape of one hook point in the {@link ExtensionHookPoints} map. */
export interface HookPointSpec<TKind extends HookKind, TPayload> {
  kind: TKind
  payload: TPayload
}

export type NotifyHookPointHandler<TPayload> = (payload: TPayload) => MaybePromise<void>

export type WaterfallHookPointHandler<TValue> = (value: TValue) => MaybePromise<TValue>

export type VetoHookPointHandler<TPayload> = (payload: TPayload) => MaybePromise<HookVeto | void>
