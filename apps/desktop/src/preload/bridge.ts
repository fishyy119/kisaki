import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { IpcMainHandlers, IpcMainListeners, IpcRendererEvents } from '@shared/ipc'

type IpcRendererListener = (event: IpcRendererEvent, ...args: unknown[]) => void

/**
 * Channels one window kind may reach.
 *
 * Windows that render foreign content declare a policy so a compromised
 * document cannot walk the whole IPC surface; the app's own windows pass
 * `null` and keep the full surface.
 */
export interface IpcChannelPolicy {
  invoke: readonly (keyof IpcMainHandlers)[]
  send: readonly (keyof IpcMainListeners)[]
  receive: readonly (keyof IpcRendererEvents)[]
}

export type KisakiPreloadBridge = ReturnType<typeof createBridge>

/** Installs the `window.kisaki` bridge, confined to `policy` when given. */
export function exposeIpcBridge(policy: IpcChannelPolicy | null): void {
  contextBridge.exposeInMainWorld('kisaki', createBridge(policy))
}

function createBridge(policy: IpcChannelPolicy | null) {
  const allowedInvoke = policy ? new Set<string>(policy.invoke) : null
  const allowedSend = policy ? new Set<string>(policy.send) : null
  const allowedReceive = policy ? new Set<string>(policy.receive) : null

  const noop = (): void => {}

  return {
    ipcRenderer: {
      send(channel: string, ...args: unknown[]): void {
        if (!isAllowed(allowedSend, channel)) return
        ipcRenderer.send(channel, ...args)
      },
      invoke(channel: string, ...args: unknown[]): Promise<unknown> {
        if (!isAllowed(allowedInvoke, channel)) {
          return Promise.reject(new Error(`IPC channel "${channel}" is not available here.`))
        }
        return ipcRenderer.invoke(channel, ...args)
      },
      on(channel: string, listener: IpcRendererListener): () => void {
        if (!isAllowed(allowedReceive, channel)) return noop
        ipcRenderer.on(channel, listener)
        return () => {
          ipcRenderer.removeListener(channel, listener)
        }
      },
      once(channel: string, listener: IpcRendererListener): () => void {
        if (!isAllowed(allowedReceive, channel)) return noop
        ipcRenderer.once(channel, listener)
        return () => {
          ipcRenderer.removeListener(channel, listener)
        }
      }
    }
  }
}

function isAllowed(allowed: ReadonlySet<string> | null, channel: string): boolean {
  return allowed === null || allowed.has(channel)
}
