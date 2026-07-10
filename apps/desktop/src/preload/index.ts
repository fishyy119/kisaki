import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

type IpcRendererListener = (event: IpcRendererEvent, ...args: unknown[]) => void

/** Minimal IPC surface exposed to renderer windows; consumed through @renderer/core/ipc. */
const bridge = {
  ipcRenderer: {
    send(channel: string, ...args: unknown[]): void {
      ipcRenderer.send(channel, ...args)
    },
    invoke(channel: string, ...args: unknown[]): Promise<unknown> {
      return ipcRenderer.invoke(channel, ...args)
    },
    on(channel: string, listener: IpcRendererListener): () => void {
      ipcRenderer.on(channel, listener)
      return () => {
        ipcRenderer.removeListener(channel, listener)
      }
    },
    once(channel: string, listener: IpcRendererListener): () => void {
      ipcRenderer.once(channel, listener)
      return () => {
        ipcRenderer.removeListener(channel, listener)
      }
    }
  }
}

export type KisakiPreloadBridge = typeof bridge

contextBridge.exposeInMainWorld('kisaki', bridge)
