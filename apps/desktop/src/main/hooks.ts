/**
 * Module hook engine.
 *
 * Modules instantiate their own hook points with these factories and dispatch
 * them at workflow boundaries. Subscribers (app-internal code or the extension
 * hooks contribution point) tap hooks without the module knowing who listens.
 *
 * Kinds:
 * - Notify: after-the-fact notification; dispatch never affects the workflow.
 * - Waterfall: ordered value transformation; a failing tap is skipped and the
 *   previous value is kept.
 * - Veto: ordered gatekeeping; the first tap that vetoes stops dispatch, and a
 *   failing tap counts as "no veto".
 *
 * Anchor rules: waterfall/veto hooks dispatch before write transactions,
 * notify hooks dispatch after commit. Hooks never run inside a transaction.
 */

import { createLogger } from '@main/log'

const log = createLogger('Hook')

export type HookUntap = () => void

export interface HookTapOptions {
  /** Ascending dispatch order; equal priorities keep tap registration order. */
  priority?: number
}

export interface NotifySettleOptions {
  /** Total time budget for awaiting all taps before giving up. */
  budgetMs: number
}

export type NotifyHookHandler<TPayload> = (payload: TPayload) => void | Promise<void>

export type WaterfallHookHandler<TValue> = (value: TValue) => TValue | Promise<TValue>

export interface HookVeto {
  veto: true
  reason?: string
}

export type VetoHookResult = HookVeto | void

export type VetoHookHandler<TPayload> = (
  payload: TPayload
) => VetoHookResult | Promise<VetoHookResult>

export interface NotifyHook<TPayload> {
  tap(handler: NotifyHookHandler<TPayload>, options?: HookTapOptions): HookUntap
  /** Fire-and-forget dispatch; tap failures are logged and never propagate. */
  dispatch(payload: TPayload): void
  /** Awaited dispatch bounded by a total budget, for flush-window anchors. */
  settle(payload: TPayload, options: NotifySettleOptions): Promise<void>
  hasTaps(): boolean
}

export interface WaterfallHook<TValue> {
  tap(handler: WaterfallHookHandler<TValue>, options?: HookTapOptions): HookUntap
  /** Run taps in order; a failing tap is skipped and the previous value kept. */
  transform(value: TValue): Promise<TValue>
  hasTaps(): boolean
}

export interface VetoHook<TPayload> {
  tap(handler: VetoHookHandler<TPayload>, options?: HookTapOptions): HookUntap
  /** Run taps in order; returns the first veto, or null when nobody vetoes. */
  dispatch(payload: TPayload): Promise<HookVeto | null>
  hasTaps(): boolean
}

interface HookTap<THandler> {
  handler: THandler
  priority: number
  order: number
}

class TapList<THandler> {
  private readonly taps: HookTap<THandler>[] = []
  private orderCounter = 0

  add(handler: THandler, options?: HookTapOptions): HookUntap {
    const tap: HookTap<THandler> = {
      handler,
      priority: options?.priority ?? 0,
      order: this.orderCounter++
    }

    const insertAt = this.taps.findIndex(
      (existing) =>
        existing.priority > tap.priority ||
        (existing.priority === tap.priority && existing.order > tap.order)
    )
    if (insertAt === -1) {
      this.taps.push(tap)
    } else {
      this.taps.splice(insertAt, 0, tap)
    }

    return () => {
      const index = this.taps.indexOf(tap)
      if (index !== -1) {
        this.taps.splice(index, 1)
      }
    }
  }

  snapshot(): readonly THandler[] {
    return this.taps.map((tap) => tap.handler)
  }

  get size(): number {
    return this.taps.length
  }
}

export function createNotifyHook<TPayload>(name: string): NotifyHook<TPayload> {
  const taps = new TapList<NotifyHookHandler<TPayload>>()

  const run = async (payload: TPayload): Promise<void> => {
    for (const handler of taps.snapshot()) {
      try {
        await handler(payload)
      } catch (error) {
        log.error('Notify tap failed.', error, { hook: name })
      }
    }
  }

  return {
    tap: (handler, options) => taps.add(handler, options),
    dispatch: (payload) => {
      if (taps.size === 0) {
        return
      }
      void run(payload)
    },
    settle: async (payload, options) => {
      if (taps.size === 0) {
        return
      }

      let budgetElapsed = false
      const budget = new Promise<void>((resolve) => {
        setTimeout(() => {
          budgetElapsed = true
          resolve()
        }, options.budgetMs).unref?.()
      })

      await Promise.race([run(payload), budget])
      if (budgetElapsed) {
        log.warn('Notify settle exceeded budget.', { hook: name, budgetMs: options.budgetMs })
      }
    },
    hasTaps: () => taps.size > 0
  }
}

export function createWaterfallHook<TValue>(name: string): WaterfallHook<TValue> {
  const taps = new TapList<WaterfallHookHandler<TValue>>()

  return {
    tap: (handler, options) => taps.add(handler, options),
    transform: async (value) => {
      if (taps.size === 0) {
        return value
      }

      let current = value
      for (const handler of taps.snapshot()) {
        try {
          current = await handler(current)
        } catch (error) {
          log.error('Waterfall tap failed; keeping previous value.', error, { hook: name })
        }
      }
      return current
    },
    hasTaps: () => taps.size > 0
  }
}

export function createVetoHook<TPayload>(name: string): VetoHook<TPayload> {
  const taps = new TapList<VetoHookHandler<TPayload>>()

  return {
    tap: (handler, options) => taps.add(handler, options),
    dispatch: async (payload) => {
      if (taps.size === 0) {
        return null
      }

      for (const handler of taps.snapshot()) {
        try {
          const result = await handler(payload)
          if (result?.veto) {
            return result
          }
        } catch (error) {
          log.error('Veto tap failed; treating as no veto.', error, { hook: name })
        }
      }
      return null
    },
    hasTaps: () => taps.size > 0
  }
}
