import type { ExtensionInstallationsHooks } from '../../../installations/hooks'
import type { ExtensionHookContributionPoint } from '../point'

/**
 * Binds extension lifecycle hooks to their public hook points. Called after
 * the installation manager exists, since it owns these hooks.
 */
export function bindExtensionLifecycleHookPoints(
  installations: ExtensionInstallationsHooks,
  point: ExtensionHookContributionPoint
): void {
  installations.enabled.tap((p) => point.notify('extension.enabled', p))
  installations.disabled.tap((p) => point.notify('extension.disabled', p))
}
