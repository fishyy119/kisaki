/**
 * Extension installations module hooks.
 */

import { createNotifyHook, type NotifyHook } from '@main/hooks'

export interface ExtensionLifecyclePayload {
  extensionId: string
}

export interface ExtensionInstallationsHooks {
  /** Fires after an extension is enabled and its runtime is ready. */
  enabled: NotifyHook<ExtensionLifecyclePayload>
  /** Fires after an extension is disabled and its runtime is stopped. */
  disabled: NotifyHook<ExtensionLifecyclePayload>
}

export function createExtensionInstallationsHooks(): ExtensionInstallationsHooks {
  return {
    enabled: createNotifyHook<ExtensionLifecyclePayload>('extension.enabled'),
    disabled: createNotifyHook<ExtensionLifecyclePayload>('extension.disabled')
  }
}
