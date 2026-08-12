/**
 * mpv JSON IPC client.
 *
 * Speaks mpv's newline-delimited JSON protocol over the socket named by
 * `--input-ipc-server`. mpv creates the socket asynchronously after start, so
 * connecting retries until the deadline. Command replies are correlated by
 * request id; asynchronous events and property changes are delivered to the
 * listeners the owning session registers.
 */

import { Socket } from 'node:net'
import { createLogger } from '@main/log'

const log = createLogger('Player')

const CONNECT_RETRY_INTERVAL_MS = 100
const COMMAND_TIMEOUT_MS = 5000

export interface MpvEvent {
  event: string
  /** Present on `property-change`. */
  name?: string
  /** Present on `property-change`; type depends on the observed property. */
  data?: unknown
  /** Present on `end-file`. */
  reason?: string
}

interface PendingCommand {
  resolve: (data: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

export class MpvIpcClient {
  private socket?: Socket
  private buffer = ''
  private nextRequestId = 1
  private readonly pending = new Map<number, PendingCommand>()
  private eventListener?: (event: MpvEvent) => void
  private closeListener?: () => void

  constructor(private readonly socketPath: string) {}

  onEvent(listener: (event: MpvEvent) => void): void {
    this.eventListener = listener
  }

  onClose(listener: () => void): void {
    this.closeListener = listener
  }

  /** Connects with retries, resolving false when the deadline passes. */
  async connect(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const socket = await tryConnect(this.socketPath)
      if (socket) {
        this.attach(socket)
        return true
      }
      await delay(CONNECT_RETRY_INTERVAL_MS)
    }

    return false
  }

  /** Sends a command and resolves with its reply data. */
  async command(...args: (string | number | boolean)[]): Promise<unknown> {
    const socket = this.socket
    if (!socket) {
      throw new Error('mpv IPC is not connected.')
    }

    const requestId = this.nextRequestId++
    const payload = `${JSON.stringify({ command: args, request_id: requestId })}\n`

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error(`mpv command timed out: ${String(args[0])}`))
      }, COMMAND_TIMEOUT_MS)
      timer.unref?.()

      this.pending.set(requestId, { resolve, reject, timer })
      socket.write(payload, (error) => {
        if (error) {
          this.settle(requestId, () => reject(error))
        }
      })
    })
  }

  /** Requests `property-change` events for a property. */
  async observeProperty(id: number, property: string): Promise<void> {
    await this.command('observe_property', id, property)
  }

  async setProperty(property: string, value: string | number | boolean): Promise<void> {
    await this.command('set_property', property, value)
  }

  dispose(): void {
    for (const requestId of [...this.pending.keys()]) {
      this.settle(requestId, (pending) => pending.reject(new Error('mpv IPC closed.')))
    }

    this.socket?.destroy()
    this.socket = undefined
  }

  private attach(socket: Socket): void {
    this.socket = socket
    socket.setEncoding('utf8')

    socket.on('data', (chunk: string) => this.consume(chunk))
    socket.on('error', (error) => {
      log.warn('mpv IPC socket error.', { message: error.message })
    })
    socket.on('close', () => {
      this.socket = undefined
      this.closeListener?.()
    })
  }

  private consume(chunk: string): void {
    this.buffer += chunk

    let newlineAt = this.buffer.indexOf('\n')
    while (newlineAt !== -1) {
      const line = this.buffer.slice(0, newlineAt).trim()
      this.buffer = this.buffer.slice(newlineAt + 1)
      if (line) {
        this.handleLine(line)
      }
      newlineAt = this.buffer.indexOf('\n')
    }
  }

  private handleLine(line: string): void {
    let message: Record<string, unknown>
    try {
      message = JSON.parse(line) as Record<string, unknown>
    } catch {
      log.warn('Discarded malformed mpv IPC line.')
      return
    }

    if (typeof message['event'] === 'string') {
      this.eventListener?.(message as unknown as MpvEvent)
      return
    }

    const requestId = message['request_id']
    if (typeof requestId !== 'number') {
      return
    }

    this.settle(requestId, (pending) => {
      if (message['error'] === 'success') {
        pending.resolve(message['data'])
      } else {
        // mpv's own error text is a library message; it belongs in the log,
        // not in the error that may surface to the renderer.
        log.warn('mpv command failed.', { mpvError: String(message['error']) })
        pending.reject(new Error('mpv command failed.'))
      }
    })
  }

  private settle(requestId: number, apply: (pending: PendingCommand) => void): void {
    const pending = this.pending.get(requestId)
    if (!pending) {
      return
    }

    clearTimeout(pending.timer)
    this.pending.delete(requestId)
    apply(pending)
  }
}

function tryConnect(socketPath: string): Promise<Socket | null> {
  return new Promise((resolve) => {
    const socket = new Socket()

    const fail = (): void => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(null)
    }

    socket.once('error', fail)
    socket.connect(socketPath, () => {
      socket.removeListener('error', fail)
      resolve(socket)
    })
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref?.()
  })
}
