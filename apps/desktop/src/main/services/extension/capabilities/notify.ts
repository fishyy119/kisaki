import { nanoid } from 'nanoid'
import type {
  ExtensionRuntimeMetadata,
  NotificationHandle,
  NotificationKind,
  NotifyMode,
  NotifyOptions
} from '@kisaki3/extension-api'
import {
  createConflictError,
  createNotFoundError,
  createUnavailableError,
  createValidationError,
  normalizeCapabilityError
} from '@kisaki3/extension-api'
import type { NotifyService } from '@main/services/notify'
import type { NotifyOptions as SharedNotifyOptions } from '@shared/notify'

const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  'success',
  'info',
  'warning',
  'error',
  'loading'
]

const NOTIFY_MODES: readonly NotifyMode[] = ['toast', 'native', 'auto']

const NOTIFY_OPTION_KEYS = new Set<string>(['message', 'mode', 'id', 'closable'])

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
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw createValidationError('notify title must be a non-empty string.')
  }

  if (!NOTIFICATION_KINDS.includes(kind)) {
    throw createValidationError(`notify kind must be one of: ${NOTIFICATION_KINDS.join(', ')}.`)
  }

  if (options === undefined) {
    return { notifyOptions: { title, type: kind } }
  }

  if (typeof options === 'string') {
    return {
      notifyOptions: {
        title,
        message: options,
        type: kind
      }
    }
  }

  if (!isPlainRecord(options)) {
    throw createValidationError('notify options must be a string or an object.')
  }

  const record: Record<string, unknown> = options
  for (const key of Object.keys(record)) {
    if (!NOTIFY_OPTION_KEYS.has(key)) {
      throw createValidationError(`notify options contain an unknown field "${key}".`)
    }
  }

  const { message, mode, id, closable } = record
  if (message !== undefined && typeof message !== 'string') {
    throw createValidationError('notify options.message must be a string.')
  }

  if (mode !== undefined && !isNotifyMode(mode)) {
    throw createValidationError(`notify options.mode must be one of: ${NOTIFY_MODES.join(', ')}.`)
  }

  if (id !== undefined && (typeof id !== 'string' || id.length === 0)) {
    throw createValidationError('notify options.id must be a non-empty string.')
  }

  if (closable !== undefined && typeof closable !== 'boolean') {
    throw createValidationError('notify options.closable must be a boolean.')
  }

  return {
    notifyOptions: {
      title,
      message,
      type: kind,
      target: mode,
      closable
    },
    requestedId: id
  }
}

function isNotifyMode(value: unknown): value is NotifyMode {
  return typeof value === 'string' && (NOTIFY_MODES as readonly string[]).includes(value)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
