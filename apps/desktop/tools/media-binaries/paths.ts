import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUNDLED_BINARY_RESOURCE_DIR, getBundledBinaryPlatformDir } from '../../src/shared/binaries'

/** Filesystem paths for the bundled media tool staging workflows. */
export interface MediaBinaryToolContext {
  readonly desktopRoot: string
  /** Directory the runtime resolver reads for the current platform-arch pair. */
  readonly targetRoot: string
  readonly platform: NodeJS.Platform
  readonly arch: string
}

export function createMediaBinaryToolContext(metaUrl = import.meta.url): MediaBinaryToolContext {
  const toolDir = path.dirname(fileURLToPath(metaUrl))
  const desktopRoot = path.resolve(toolDir, '..', '..')

  return {
    desktopRoot,
    targetRoot: path.join(
      desktopRoot,
      'resources',
      BUNDLED_BINARY_RESOURCE_DIR,
      getBundledBinaryPlatformDir(process.platform, process.arch)
    ),
    platform: process.platform,
    arch: process.arch
  }
}
