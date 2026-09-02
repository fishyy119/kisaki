import { newId } from '@shared/id'
import {
  EXTENSION_HOOK_POINTS,
  validateHookPointId,
  validateHookTapOptionsShape,
  type Disposable,
  type ExtensionHookHandler,
  type ExtensionHookPointId,
  type HookInvokeRequest,
  type HookInvokeResponse,
  type HookNotifyEvent,
  type HookTapOptions,
  type HookVeto,
  type ValidationIssue
} from '@kisaki3/extension-api'
import { requireRuntimeByScope, throwValidationIssues } from '../shared'
import type { HostContributionDomainOptions, HostContributionScope } from '../types'
import { createContributionRegistration } from '../registration'

interface HostHookRegistrationRecord {
  scope: HostContributionScope
  pointId: ExtensionHookPointId
  handler: (payload: unknown) => unknown
}

/**
 * Host side of the hooks contribution point: validates registrations coming
 * from `context.hooks.on`, mirrors them to the main registry, and executes
 * handlers when main invokes or notifies a point.
 */
export class HostHooksContributionPoint {
  private readonly registrations = new Map<string, HostHookRegistrationRecord>()

  constructor(private readonly options: HostContributionDomainOptions) {}

  register<TPoint extends ExtensionHookPointId>(
    scope: HostContributionScope,
    pointId: TPoint,
    handler: ExtensionHookHandler<TPoint>,
    tapOptions?: HookTapOptions
  ): Disposable {
    const issues: ValidationIssue[] = [
      ...validateHookPointId(pointId, '$.pointId'),
      ...validateHookTapOptionsShape(tapOptions, '$.options')
    ]
    if (typeof handler !== 'function') {
      issues.push({ path: '$.handler', message: 'Hook handler must be a function.' })
    }
    if (issues.length > 0) {
      throwValidationIssues('Hook registration', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    const registrationId = newId()
    this.registrations.set(registrationId, {
      scope,
      pointId,
      handler: handler as (payload: unknown) => unknown
    })

    const request = this.options.rpc.requestMain(
      'contributions.hooks.register',
      {
        runtimeHandle: scope.runtimeHandle,
        hook: {
          registrationId,
          pointId,
          ...(tapOptions?.priority === undefined ? {} : { priority: tapOptions.priority })
        }
      },
      this.options.getRequestOptions(scope)
    )

    const registration = createContributionRegistration({
      scope,
      label: `Hook registration "${pointId}"`,
      mainRegistration: request,
      reportDiagnostic: (diagnostic) => this.options.reportDiagnostic(scope, diagnostic),
      disposeLocal: () => {
        this.registrations.delete(registrationId)
      },
      unregisterMain: () =>
        this.options.rpc.requestMain(
          'contributions.hooks.unregister',
          {
            runtimeHandle: scope.runtimeHandle,
            registrationId
          },
          this.options.getCleanupRequestOptions(scope)
        ),
      invalidateLocal: () => {
        this.registrations.delete(registrationId)
      },
      onSyncFailure: (error) => {
        runtime.context.logger.error(
          `Hook registration "${pointId}" was disabled because main registry synchronization failed.`,
          error
        )
      }
    })
    this.options.trackMainRequest(scope, registration.sync)
    return { dispose: () => registration.dispose() }
  }

  /** Executes a waterfall, veto, or awaited-notify handler for main. */
  async invoke(request: HookInvokeRequest, signal: AbortSignal): Promise<HookInvokeResponse> {
    const record = this.registrations.get(request.registrationId)
    if (!record) {
      throw new Error(`Hook registration "${request.registrationId}" is not active.`)
    }

    const kind = EXTENSION_HOOK_POINTS[record.pointId].kind
    const result = await this.options.runInExtensionContext(
      record.scope,
      () => record.handler(request.payload),
      signal
    )

    if (kind === 'waterfall') {
      // An undefined return keeps the incoming value, so a handler cannot
      // silently drop the waterfall chain by forgetting to return.
      return { result: result === undefined ? request.payload : (result as never) }
    }

    if (kind === 'veto') {
      if (isHookVeto(result)) {
        const reason = typeof result.reason === 'string' ? result.reason : undefined
        return { result: reason === undefined ? { veto: true } : { veto: true, reason } }
      }
      return { result: null }
    }

    return { result: null }
  }

  /** Executes a pure notify handler; failures are logged, never propagated. */
  handleNotify(event: HookNotifyEvent): void {
    const record = this.registrations.get(event.registrationId)
    if (!record) {
      return
    }

    void Promise.resolve(
      this.options.runInExtensionContext(record.scope, () => record.handler(event.payload))
    ).catch((error) => {
      console.warn(
        `[ExtensionHost][${record.scope.extensionId}] Hook handler "${record.pointId}" failed:`,
        error
      )
    })
  }

  releaseRuntime(runtimeHandle: string): void {
    for (const [registrationId, record] of [...this.registrations]) {
      if (record.scope.runtimeHandle === runtimeHandle) {
        this.registrations.delete(registrationId)
      }
    }
  }

  releaseAll(): void {
    this.registrations.clear()
  }
}

function isHookVeto(value: unknown): value is HookVeto {
  return typeof value === 'object' && value !== null && (value as { veto?: unknown }).veto === true
}
