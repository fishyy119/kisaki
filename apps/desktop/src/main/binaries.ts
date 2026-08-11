/**
 * Bundled native tool resolution.
 *
 * The playback and probing services depend on external executables that ship as
 * unpacked extra resources. Resolution order is explicit override, bundled copy,
 * then a PATH lookup so a development checkout works with a system install.
 */

import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { app } from 'electron'
import { isDev } from '@main/env'
import {
  BUNDLED_BINARY_RESOURCE_DIR,
  getBundledBinaryPlatformDir,
  toBundledExecutableName,
  type BundledBinary
} from '@shared/binaries'

/** Environment overrides let a developer point at a local build of a tool. */
const OVERRIDE_ENV_VARS: Record<BundledBinary, string> = {
  mpv: 'KISAKI_MPV_PATH',
  ffprobe: 'KISAKI_FFPROBE_PATH'
}

/**
 * Resolves an executable path, or null when the tool is unavailable. Callers
 * must degrade to a stable failure reason instead of assuming a path exists.
 */
export function resolveBundledBinary(name: BundledBinary): string | null {
  const override = process.env[OVERRIDE_ENV_VARS[name]]
  if (override && existsSync(override)) {
    return override
  }

  const executable = toBundledExecutableName(name, process.platform)
  const bundled = join(binaryRoot(), executable)
  if (existsSync(bundled)) {
    return bundled
  }

  return findOnPath(executable)
}

function binaryRoot(): string {
  const resources = isDev
    ? join(app.getAppPath(), 'resources')
    : join(process.resourcesPath, 'app.asar.unpacked', 'resources')

  return join(
    resources,
    BUNDLED_BINARY_RESOURCE_DIR,
    getBundledBinaryPlatformDir(process.platform, process.arch)
  )
}

function findOnPath(executable: string): string | null {
  const searchPath = process.env['PATH']
  if (!searchPath) {
    return null
  }

  for (const dir of searchPath.split(delimiter)) {
    if (!dir) {
      continue
    }

    const candidate = join(dir, executable)
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}
