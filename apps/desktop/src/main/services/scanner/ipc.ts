import type { IpcService } from '@main/services/ipc'
import { wrapIpc } from '@main/services/ipc'
import type { ScannerService } from './service'

export function registerScannerIpc(service: ScannerService, ipc: IpcService): void {
  ipc.handle('scanner:start-scan', async (_, scannerId) =>
    wrapIpc(() => service.startScanner(scannerId))
  )

  ipc.handle('scanner:start-all-scans', async () => wrapIpc(() => service.startAllScanners()))

  ipc.handle('scanner:list-run-states', async () => wrapIpc(() => service.listRunStates()))

  ipc.handle('scanner:pause-scan', async (_, scannerId) =>
    wrapIpc(() => service.pauseScanner(scannerId))
  )

  ipc.handle('scanner:resume-scan', async (_, scannerId) =>
    wrapIpc(() => service.resumeScanner(scannerId))
  )

  ipc.handle('scanner:cancel-scan', async (_, scannerId) =>
    wrapIpc(() => service.cancelScanner(scannerId))
  )

  ipc.handle('scanner:test-extraction-rules', async (_, scannerPath, entityDepth, rules) =>
    wrapIpc(() => service.discovery.testExtractionRules(scannerPath, entityDepth, rules))
  )
}
