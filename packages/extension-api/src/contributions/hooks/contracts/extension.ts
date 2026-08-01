import type { HookPointSpec } from './point'

export interface ExtensionLifecyclePayload {
  extensionId: string
}

/** Extension lifecycle hook points (notify only). */
export interface ExtensionHookLifecyclePoints {
  'extension.enabled': HookPointSpec<'notify', ExtensionLifecyclePayload>
  'extension.disabled': HookPointSpec<'notify', ExtensionLifecyclePayload>
}
