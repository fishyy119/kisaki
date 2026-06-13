/**
 * Bootstrap Arguments Parser
 *
 * Parses early bootstrap arguments used by the main process.
 */

import path from 'node:path'
import type {
  BootstrapArgs,
  DevelopmentExtension,
  ExtensionHostInspectOptions
} from '@shared/bootstrap'
import { wrapIpc, type IpcService } from '@main/services/ipc'

const DEVELOPMENT_EXTENSIONS_ENV = 'KISAKI_DEV_EXTENSIONS'

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
  const developmentExtensions = parseDevelopmentExtensionsEnv()
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

  return { help, version, developmentExtensions, extensionHostInspect }
}

/**
 * Reads the development extensions to load from disk. Launchers (`kisx dev`,
 * the built-in extension dev harness) publish a JSON array of
 * `{ path, uiDevServerOrigin? }` entries through the environment.
 */
function parseDevelopmentExtensionsEnv(): DevelopmentExtension[] {
  const raw = process.env[DEVELOPMENT_EXTENSIONS_ENV]
  if (!raw || raw.trim().length === 0) {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) {
    return []
  }

  const extensions: DevelopmentExtension[] = []
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const { path: extensionPath, uiDevServerOrigin } = entry as Record<string, unknown>
    if (typeof extensionPath !== 'string') {
      continue
    }

    const normalizedPath = extensionPath.trim()
    if (normalizedPath.length === 0 || !path.isAbsolute(normalizedPath)) {
      continue
    }

    const normalizedUiDevServerOrigin = parseLoopbackHttpOrigin(uiDevServerOrigin)
    extensions.push({
      path: normalizedPath,
      ...(normalizedUiDevServerOrigin ? { uiDevServerOrigin: normalizedUiDevServerOrigin } : {})
    })
  }

  return extensions
}

function parseLoopbackHttpOrigin(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined
  }

  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return undefined
  }

  if (
    url.protocol !== 'http:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !isLoopbackHostname(url.hostname)
  ) {
    return undefined
  }

  return url.origin
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  if (normalized === 'localhost' || normalized === '::1' || normalized === '[::1]') {
    return true
  }

  const octets = normalized.split('.')
  if (octets.length !== 4) {
    return false
  }

  const values = octets.map((octet) => Number(octet))
  return (
    values.every((value) => Number.isInteger(value) && value >= 0 && value <= 255) &&
    values[0] === 127
  )
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
