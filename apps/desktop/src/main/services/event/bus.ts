import { createLogger } from '@main/log'
import type {
  AppEvents,
  AppEventListener,
  EventEmitOptions,
  EventUnsubscribe
} from '@shared/events'
import type { RawDbChangeEvent } from '@shared/events/library'

const log = createLogger('Event')

export interface EventBusOptions {
  forwardToRenderer(event: keyof AppEvents, args: unknown[]): void
}

export class EventBus {
  private readonly listeners = new Map<keyof AppEvents, Set<(...args: any[]) => void>>()
  private forwardingEnabled = false

  constructor(private readonly options: EventBusOptions) {}

  enableForwarding(): void {
    this.forwardingEnabled = true
  }

  on<K extends keyof AppEvents>(event: K, listener: AppEventListener<K>): EventUnsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)!.add(listener as any)

    return () => {
      this.listeners.get(event)?.delete(listener as any)
    }
  }

  once<K extends keyof AppEvents>(event: K, listener: AppEventListener<K>): EventUnsubscribe {
    const wrappedListener = ((...args: AppEvents[K]) => {
      listener(...args)
      this.listeners.get(event)?.delete(wrappedListener as any)
    }) as AppEventListener<K>

    return this.on(event, wrappedListener)
  }

  emit<K extends keyof AppEvents>(event: K, ...args: NoInfer<AppEvents[K]>): void
  emit<K extends keyof AppEvents>(
    event: K,
    options: EventEmitOptions & { local: boolean },
    ...args: NoInfer<AppEvents[K]>
  ): void
  emit<K extends keyof AppEvents>(event: K, ...args: unknown[]): void {
    let options: EventEmitOptions = { local: false }
    let eventArgs: AppEvents[K]

    if (args.length > 0 && isEventEmitOptions(args[0])) {
      options = args[0]
      eventArgs = args.slice(1) as AppEvents[K]
    } else {
      eventArgs = args as AppEvents[K]
    }

    this.emitLocal(event, ...eventArgs)

    if (!options.local && this.forwardingEnabled) {
      try {
        this.options.forwardToRenderer(event, sanitizeForwardedEventArgs(event, eventArgs))
      } catch (error) {
        log.error('Failed to forward event.', error, { event: String(event) })
      }
    }
  }

  emitLocal<K extends keyof AppEvents>(event: K, ...args: NoInfer<AppEvents[K]>): void {
    const eventListeners = this.listeners.get(event)
    if (!eventListeners) {
      return
    }

    for (const listener of eventListeners) {
      try {
        listener(...args)
      } catch (error) {
        log.error('Error in listener.', error, { event: String(event) })
      }
    }
  }

  off<K extends keyof AppEvents>(event: K): void {
    this.listeners.delete(event)
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }

  listenerCount<K extends keyof AppEvents>(event: K): number {
    return this.listeners.get(event)?.size ?? 0
  }

  dispose(): void {
    this.forwardingEnabled = false
    this.removeAllListeners()
  }
}

function isEventEmitOptions(value: unknown): value is EventEmitOptions {
  return typeof value === 'object' && value !== null && 'local' in value
}

function sanitizeForwardedEventArgs<K extends keyof AppEvents>(
  event: K,
  args: AppEvents[K]
): unknown[] {
  if (event !== 'db:inserted' && event !== 'db:updated' && event !== 'db:deleted') {
    return args
  }

  const change = args[0] as RawDbChangeEvent | undefined
  if (!change) {
    return args
  }

  return [
    {
      operation: change.operation,
      table: change.table,
      id: change.id,
      occurredAt: change.occurredAt
    }
  ]
}
