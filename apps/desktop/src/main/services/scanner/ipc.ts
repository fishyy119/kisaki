import type { IpcService } from '@main/services/ipc'
import { wrapIpc } from '@main/services/ipc'
import type { ScannerService } from './service'

export function registerScannerIpc(service: ScannerService, ipc: IpcService): void {
  ipc.handle('scanner:start-game-scan', async (_, scannerId) =>
    wrapIpc(() => service.game.startScanner(scannerId))
  )

  ipc.handle('scanner:start-all-game-scans', async () =>
    wrapIpc(() => service.game.startAllScanners())
  )

  ipc.handle('scanner:list-run-states', async () => wrapIpc(() => service.game.listRunStates()))

  ipc.handle('scanner:pause-scan', async (_, scannerId) =>
    wrapIpc(() => service.game.pauseScanner(scannerId))
  )

  ipc.handle('scanner:resume-scan', async (_, scannerId) =>
    wrapIpc(() => service.game.resumeScanner(scannerId))
  )

  ipc.handle('scanner:cancel-scan', async (_, scannerId) =>
    wrapIpc(() => service.game.cancelScanner(scannerId))
  )

  ipc.handle('scanner:test-extraction-rules', async (_, scannerPath, entityDepth, rules) =>
    wrapIpc(() => service.discovery.testExtractionRules(scannerPath, entityDepth, rules))
  )
}
