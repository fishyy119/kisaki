import {
  matchesKnownHookPointId,
  type ExtensionHookPointId,
  type ExtensionRuntimeHandle,
  type HookNotifyEvent,
  type HookRegistrationInfo,
  type JsonValue,
  type MainToHostRpcEvent,
  type MainToHostRpcEventMap,
  type UndefinedTolerant
} from '@kisaki3/extension-api'
import { createLogger } from '@main/log'
import type { HookVeto } from '@main/hooks'
import {
  requireContributionOwner,
  type ExtensionContributionPointOptions,
  type ExtensionContributionReleaseDiagnostic,
  type RuntimeContributionOwner
} from '../types'

const log = createLogger('Extension')

/** Per-registration round-trip budget for waterfall/veto/awaited-notify taps. */
const HOOK_INVOKE_TIMEOUT_MS = 10_000

export interface ExtensionHookContributionPointOptions extends ExtensionContributionPointOptions {
  sendEventToHost<K extends MainToHostRpcEvent>(
    name: K,
    payload: UndefinedTolerant<MainToHostRpcEventMap[K]>
  ): void
}

interface HookRegistrationRecord {
  owner: RuntimeContributionOwner
  registrationId: string
  pointId: ExtensionHookPointId
  priority: number
  order: number
}

/**
 * Main side of the hooks contribution point.
 *
 * Stores extension hook registrations and acts as the dispatcher the domain
 * binding tables tap into module hooks. Boundary policy per kind: waterfall
 * failures keep the previous value, veto failures count as "no veto", pure
 * notify is one-way and never blocks, awaited notify is bounded per tap by
 * the invoke timeout and overall by the dispatching anchor's budget.
 */
export class ExtensionHookContributionPoint {
  private readonly registrations = new Map<string, HookRegistrationRecord>()
  private readonly byPoint = new Map<ExtensionHookPointId, HookRegistrationRecord[]>()
  private nextOrder = 0

  constructor(private readonly options: ExtensionHookContributionPointOptions) {}

  register(runtimeHandle: ExtensionRuntimeHandle, hook: HookRegistrationInfo): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)

    if (!matchesKnownHookPointId(hook.pointId)) {
      throw new Error(`Unknown hook point "${hook.pointId}".`)
    }
    if (typeof hook.registrationId !== 'string' || hook.registrationId.length === 0) {
      throw new Error('Hook registration id must be a non-empty string.')
    }
    if (this.registrations.has(hook.registrationId)) {
      throw new Error(`Hook registration "${hook.registrationId}" is already active.`)
    }

    const record: HookRegistrationRecord = {
      owner,
      registrationId: hook.registrationId,
      pointId: hook.pointId,
      priority: hook.priority ?? 0,
      order: this.nextOrder++
    }

    this.registrations.set(record.registrationId, record)
    this.insertIntoPoint(record)
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, registrationId: string): void {
    const record = this.registrations.get(registrationId)
    if (!record || record.owner.runtimeHandle !== runtimeHandle) {
      return
    }

    this.registrations.delete(registrationId)
    this.removeFromPoint(record)
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [registrationId, record] of [...this.registrations]) {
      if (record.owner.runtimeHandle === runtimeHandle) {
        this.registrations.delete(registrationId)
        this.removeFromPoint(record)
      }
    }
  }

  releaseAll(): void {
    this.registrations.clear()
    this.byPoint.clear()
  }

  getReleaseDiagnostics(extensionId: string): readonly ExtensionContributionReleaseDiagnostic[] {
    const diagnostics: ExtensionContributionReleaseDiagnostic[] = []

    for (const record of this.registrations.values()) {
      if (record.owner.extension.id === extensionId) {
        diagnostics.push({ domain: 'hooks', detail: record.pointId })
      }
    }

    return diagnostics
  }

  /** Runs registered waterfall taps in order; a failing tap keeps the previous value. */
  async transform<T>(pointId: ExtensionHookPointId, value: T): Promise<T> {
    let current = value

    for (const record of this.listForPoint(pointId)) {
      try {
        const response = await this.invoke(record, current)
        current = (response.result ?? current) as T
      } catch (error) {
        log.warn('Extension hook transform failed; keeping previous value.', error, {
          hookPoint: pointId,
          extensionId: record.owner.extension.id
        })
      }
    }

    return current
  }

  /** Runs registered veto taps in order; a failing tap counts as "no veto". */
  async veto<T>(pointId: ExtensionHookPointId, payload: T): Promise<HookVeto | null> {
    for (const record of this.listForPoint(pointId)) {
      try {
        const response = await this.invoke(record, payload)
        const result = response.result
        if (isHookVeto(result)) {
          return typeof result.reason === 'string'
            ? { veto: true, reason: result.reason }
            : { veto: true }
        }
      } catch (error) {
        log.warn('Extension hook veto tap failed; treating as no veto.', error, {
          hookPoint: pointId,
          extensionId: record.owner.extension.id
        })
      }
    }

    return null
  }

  /** One-way notify delivery to every registered tap; never blocks the caller. */
  notify<T>(pointId: ExtensionHookPointId, payload: T): void {
    for (const record of this.listForPoint(pointId)) {
      const event: HookNotifyEvent = {
        runtimeHandle: record.owner.runtimeHandle,
        registrationId: record.registrationId,
        pointId,
        payload: payload as JsonValue
      }
      this.options.sendEventToHost('contributions.hooks.notify', event)
    }
  }

  /** Awaited notify delivery for flush-window anchors; tap failures are logged. */
  async settle<T>(pointId: ExtensionHookPointId, payload: T): Promise<void> {
    await Promise.all(
      this.listForPoint(pointId).map(async (record) => {
        try {
          await this.invoke(record, payload)
        } catch (error) {
          log.warn('Extension hook settle tap failed.', error, {
            hookPoint: pointId,
            extensionId: record.owner.extension.id
          })
        }
      })
    )
  }

  private invoke(
    record: HookRegistrationRecord,
    payload: unknown
  ): Promise<{ result: JsonValue | null }> {
    return this.options.requestHost(
      'contributions.hooks.invoke',
      {
        runtimeHandle: record.owner.runtimeHandle,
        registrationId: record.registrationId,
        pointId: record.pointId,
        payload: payload as JsonValue
      },
      { timeoutMs: HOOK_INVOKE_TIMEOUT_MS }
    )
  }

  private listForPoint(pointId: ExtensionHookPointId): readonly HookRegistrationRecord[] {
    return this.byPoint.get(pointId) ?? []
  }

  private insertIntoPoint(record: HookRegistrationRecord): void {
    const records = this.byPoint.get(record.pointId) ?? []
    const insertAt = records.findIndex(
      (existing) =>
        existing.priority > record.priority ||
        (existing.priority === record.priority && existing.order > record.order)
    )
    if (insertAt === -1) {
      records.push(record)
    } else {
      records.splice(insertAt, 0, record)
    }
    this.byPoint.set(record.pointId, records)
  }

  private removeFromPoint(record: HookRegistrationRecord): void {
    const records = this.byPoint.get(record.pointId)
    if (!records) {
      return
    }

    const next = records.filter((entry) => entry !== record)
    if (next.length === 0) {
      this.byPoint.delete(record.pointId)
    } else {
      this.byPoint.set(record.pointId, next)
    }
  }
}

function isHookVeto(value: unknown): value is HookVeto {
  return typeof value === 'object' && value !== null && (value as { veto?: unknown }).veto === true
}
