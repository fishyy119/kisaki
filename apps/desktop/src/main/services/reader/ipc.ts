import { BrowserWindow } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { ReaderService } from './service'

export function registerReaderIpc(service: ReaderService, ipc: IpcService): void {
  ipc.handle('reader:bootstrap', async (event) =>
    wrapIpc(() => service.requireBootstrap(senderWindowId(event)))
  )

  ipc.handle('reader:progress', async (event, report) =>
    wrapIpcVoid(() => {
      service.reportProgress(senderWindowId(event), report)
    })
  )

  ipc.handle('reader:unit-opened', async (event, report) =>
    wrapIpcVoid(() => {
      service.reportUnitOpened(senderWindowId(event), report)
    })
  )

  ipc.handle('reader:probe-pages', async (event, fileId) =>
    wrapIpc(() => service.probeUnitPages(senderWindowId(event), fileId))
  )

  ipc.handle('reader:set-page-flow', async (event, report) =>
    wrapIpcVoid(() => {
      service.reportPageFlow(senderWindowId(event), report)
    })
  )

  ipc.handle('reader:set-fullscreen', async (event, fullScreen) =>
    wrapIpcVoid(() => {
      service.windows.setFullScreen(senderWindowId(event), fullScreen)
    })
  )

  ipc.handle('reader:close', async (event) =>
    wrapIpcVoid(() => {
      service.windows.close(senderWindowId(event))
    })
  )
}

function senderWindowId(event: IpcMainInvokeEvent): number {
  return BrowserWindow.fromWebContents(event.sender)?.id ?? -1
}
