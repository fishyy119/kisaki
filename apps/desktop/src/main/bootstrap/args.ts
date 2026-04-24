/**
 * Bootstrap Arguments Parser
 *
 * Parses early bootstrap arguments used by the main process.
 */

import log from 'electron-log/main'
import type { BootstrapArgs } from '@shared/bootstrap'
import type { IpcService } from '@main/services/ipc'

export function setupBootstrapArgsIpc(ipc: Pick<IpcService, 'handle'>): void {
  ipc.handle('app:get-bootstrap-args', () => {
    return { success: true, data: getBootstrapArgs() }
  })
}

/**
 * Cached bootstrap args (parsed once).
 */
let cachedArgs: BootstrapArgs | null = null

/**
 * Get bootstrap arguments from command line (parsed once).
 */
export function getBootstrapArgs(): BootstrapArgs {
  if (cachedArgs) return cachedArgs

  cachedArgs = parseBootstrapArgs()
  return cachedArgs
}

function parseBootstrapArgs(): BootstrapArgs {
  let help = false
  let version = false
  let devExtension: string | undefined

  for (const arg of process.argv) {
    if (arg === '--help' || arg === '-h') {
      help = true
      continue
    }

    if (arg === '--version' || arg === '-V') {
      version = true
      continue
    }

    if (arg.startsWith('--dev-extension=')) {
      devExtension = arg.slice('--dev-extension='.length)
      log.info('[Args] Dev extension:', devExtension)
      continue
    }
  }

  return { help, version, devExtension }
}
