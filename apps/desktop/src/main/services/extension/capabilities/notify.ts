import { nanoid } from 'nanoid'
import type {
  ExtensionRuntimeMetadata,
  NotificationHandle,
  NotificationKind,
  NotifyOptions
} from '@kisaki3/extension-api'
import {
  createConflictError,
  createNotFoundError,
  createUnavailableError,
  normalizeCapabilityError
} from '@kisaki3/extension-api'
import type { NotifyService } from '@main/services/notify'
import type { NotifyOptions as SharedNotifyOptions } from '@shared/notify'

export interface ExtensionNotifyCapabilityProviderOptions {
  notify: NotifyService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionNotifyCapabilityProvider {
  private readonly handleOwners = new Map<string, string>()
  private readonly handlesByRuntime = new Map<string, Set<string>>()

  constructor(private readonly options: ExtensionNotifyCapabilityProviderOptions) {}

  async show(
    runtimeHandle: string,
    kind: NotificationKind,
    title: string,
    options?: string | NotifyOptions
  ): Promise<NotificationHandle> {
    this.requireRuntime(runtimeHandle)

    try {
      const normalized = normalizeOptions(title, options, kind)
      if (normalized.requestedId) {
        this.requireHandleAvailable(runtimeHandle, normalized.requestedId)
      }

      const handleId =
        this.options.notify.show(normalized.notifyOptions, normalized.requestedId) ??
        normalized.requestedId ??
        nanoid()

      this.trackHandle(runtimeHandle, handleId)
      return { id: handleId }
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to show the notification.')
    }
  }

  async update(
    runtimeHandle: string,
    id: string,
    kind: NotificationKind,
    title: string,
    options?: string | NotifyOptions
  ): Promise<void> {
    this.requireOwnedHandle(runtimeHandle, id)

    try {
      const normalized = normalizeOptions(title, options, kind)
      this.options.notify.update(id, normalized.notifyOptions)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the notification.')
    }
  }

  async dismiss(runtimeHandle: string, id: string): Promise<void> {
    this.requireOwnedHandle(runtimeHandle, id)

    try {
      this.options.notify.dismiss(id)
      this.untrackHandle(runtimeHandle, id)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to dismiss the notification.')
    }
  }

  releaseRuntime(runtimeHandle: string): void {
    const handles = this.handlesByRuntime.get(runtimeHandle)
    if (!handles) {
      return
    }

    for (const id of [...handles]) {
      try {
        this.options.notify.dismiss(id)
      } catch {
        // Best-effort cleanup; renderer/native state may already be gone.
      } finally {
        this.untrackHandle(runtimeHandle, id)
      }
    }
  }

  releaseAll(): void {
    for (const runtimeHandle of [...this.handlesByRuntime.keys()]) {
      this.releaseRuntime(runtimeHandle)
    }
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }

  private requireHandleAvailable(runtimeHandle: string, id: string): void {
    const owner = this.handleOwners.get(id)
    if (owner && owner !== runtimeHandle) {
      throw createConflictError('Notification handle is already active for another extension.')
    }
  }

  private requireOwnedHandle(runtimeHandle: string, id: string): void {
    this.requireRuntime(runtimeHandle)

    if (this.handleOwners.get(id) !== runtimeHandle) {
      throw createNotFoundError('Notification handle is not active for this extension.')
    }
  }

  private trackHandle(runtimeHandle: string, id: string): void {
    this.handleOwners.set(id, runtimeHandle)

    let scopedHandles = this.handlesByRuntime.get(runtimeHandle)
    if (!scopedHandles) {
      scopedHandles = new Set()
      this.handlesByRuntime.set(runtimeHandle, scopedHandles)
    }

    scopedHandles.add(id)
  }

  private untrackHandle(runtimeHandle: string, id: string): void {
    this.handleOwners.delete(id)

    const scopedHandles = this.handlesByRuntime.get(runtimeHandle)
    if (!scopedHandles) {
      return
    }

    scopedHandles.delete(id)
    if (scopedHandles.size === 0) {
      this.handlesByRuntime.delete(runtimeHandle)
    }
  }
}

function normalizeOptions(
  title: string,
  options: string | NotifyOptions | undefined,
  kind: NotificationKind
): {
  notifyOptions: SharedNotifyOptions
  requestedId?: string
} {
  if (typeof options === 'string') {
    return {
      notifyOptions: {
        title,
        message: options,
        type: kind
      }
    }
  }

  return {
    notifyOptions: {
      title,
      message: options?.message,
      type: kind,
      target: options?.mode,
      closable: options?.closable
    },
    requestedId: options?.id
  }
}
