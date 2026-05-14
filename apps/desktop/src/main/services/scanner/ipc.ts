import type { IpcService } from '@main/services/ipc'
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'
import type { NameExtractionRule } from '@shared/db'
import type { ScannerService } from './service'

export function registerScannerIpc(service: ScannerService, ipc: IpcService): void {
  ipc.on('scanner:scan-game', async (_, scannerId) => {
    await service.game.scanScanner(scannerId)
  })

  ipc.on('scanner:scan-all-game', async () => {
    await service.game.scanAllScanners()
  })

  ipc.handle('scanner:pause-game', (_, scannerId) =>
    wrapIpcVoid(() => service.game.pauseScanner(scannerId))
  )

  ipc.handle('scanner:resume-game', (_, scannerId) =>
    wrapIpcVoid(() => service.game.resumeScanner(scannerId))
  )

  ipc.handle('scanner:abort-game', (_, scannerId) =>
    wrapIpcVoid(() => service.game.abortScanner(scannerId))
  )

  ipc.handle('scanner:test-extraction-rules', async (_, scannerPath, entityDepth, rules) =>
    wrapIpc(() =>
      service.testExtractionRules(scannerPath, entityDepth, rules as NameExtractionRule[])
    )
  )

  ipc.handle('scanner:get-active-scans', () => wrapIpc(() => service.game.getActiveScans()))
}
