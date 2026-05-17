/**
 * Bootstrap Arguments Parser
 *
 * Parses early bootstrap arguments used by the main process.
 */

import type { BootstrapArgs, ExtensionHostInspectOptions } from '@shared/bootstrap'
import { wrapIpc, type IpcService } from '@main/services/ipc'

const DEFAULT_EXTENSION_HOST_INSPECT_ADDRESS = '127.0.0.1:9339'

export function setupBootstrapArgsIpc(ipc: Pick<IpcService, 'handle'>): void {
  ipc.handle('app:get-bootstrap-args', () => {
    return wrapIpc(() => getBootstrapArgs())
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
  let extensionHostInspect = parseExtensionHostInspectEnv()

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
      continue
    }

    const inspectBrkValue = readOptionalArgValue(arg, '--inspect-brk-extension-host')
    if (inspectBrkValue.matched) {
      extensionHostInspect = {
        mode: 'inspect-brk',
        address: normalizeInspectAddress(inspectBrkValue.value)
      }
      continue
    }

    const inspectValue = readOptionalArgValue(arg, '--inspect-extension-host')
    if (inspectValue.matched) {
      extensionHostInspect = {
        mode: 'inspect',
        address: normalizeInspectAddress(inspectValue.value)
      }
      continue
    }
  }

  return { help, version, devExtension, extensionHostInspect }
}

function parseExtensionHostInspectEnv(): ExtensionHostInspectOptions | undefined {
  const inspectBrk = process.env['KISAKI_EXTENSION_HOST_INSPECT_BRK']
  if (isEnabledInspectValue(inspectBrk)) {
    return { mode: 'inspect-brk', address: normalizeInspectAddress(inspectBrk) }
  }

  const inspect = process.env['KISAKI_EXTENSION_HOST_INSPECT']
  if (isEnabledInspectValue(inspect)) {
    return { mode: 'inspect', address: normalizeInspectAddress(inspect) }
  }

  return undefined
}

function readOptionalArgValue(
  arg: string,
  name: string
): { matched: true; value: string | undefined } | { matched: false } {
  if (arg === name) {
    return { matched: true, value: undefined }
  }

  const prefix = `${name}=`
  if (arg.startsWith(prefix)) {
    return { matched: true, value: arg.slice(prefix.length) }
  }

  return { matched: false }
}

function isEnabledInspectValue(value: string | undefined): value is string {
  if (value === undefined) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized !== '' && normalized !== '0' && normalized !== 'false' && normalized !== 'off'
}

function normalizeInspectAddress(value: string | undefined): string {
  const normalized = value?.trim()
  if (!normalized || normalized === '1' || normalized.toLowerCase() === 'true') {
    return DEFAULT_EXTENSION_HOST_INSPECT_ADDRESS
  }

  return normalized
}
