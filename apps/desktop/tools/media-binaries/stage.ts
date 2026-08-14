import { chmod, copyFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  BUNDLED_BINARY_NAMES,
  toBundledExecutableName,
  type BundledBinary
} from '../../src/shared/binaries'
import type { MediaBinaryToolContext } from './paths'

export interface MediaBinaryStatus {
  name: BundledBinary
  executable: string
  targetPath: string
  present: boolean
}

/**
 * Copies mpv and ffprobe from a local directory into the packaged resource
 * layout. The binaries are licensed separately and are therefore fetched by
 * the maintainer rather than checked into the repository.
 */
export async function stageMediaBinaries(
  context: MediaBinaryToolContext,
  sourceDir: string
): Promise<void> {
  await mkdir(context.targetRoot, { recursive: true })

  for (const name of BUNDLED_BINARY_NAMES) {
    const executable = toBundledExecutableName(name, context.platform)
    const sourcePath = path.resolve(sourceDir, executable)

    if (!(await isFile(sourcePath))) {
      throw new Error(`Missing ${executable} in ${sourceDir}`)
    }

    const targetPath = path.join(context.targetRoot, executable)
    await copyFile(sourcePath, targetPath)
    if (context.platform !== 'win32') {
      await chmod(targetPath, 0o755)
    }
  }

  console.log(
    `[media-binaries] Staged ${BUNDLED_BINARY_NAMES.length} executable(s) into ${context.targetRoot}`
  )
}

/** Reports which bundled tools are present for the current platform-arch pair. */
export async function checkMediaBinaries(
  context: MediaBinaryToolContext
): Promise<MediaBinaryStatus[]> {
  return Promise.all(
    BUNDLED_BINARY_NAMES.map(async (name) => {
      const executable = toBundledExecutableName(name, context.platform)
      const targetPath = path.join(context.targetRoot, executable)

      return { name, executable, targetPath, present: await isFile(targetPath) }
    })
  )
}

/** Shared failure for check/ensure when the staged layout is still incomplete. */
export function missingMediaBinariesError(
  context: MediaBinaryToolContext,
  missing: readonly MediaBinaryStatus[]
): Error {
  return new Error(
    [
      `Missing bundled media tools for ${context.platform}-${context.arch}:`,
      ...missing.map((status) => `  ${status.executable} -> ${status.targetPath}`),
      'Run: pnpm --filter kisaki fetch:media-binaries (or stage:media-binaries --from <dir>)'
    ].join('\n')
  )
}

async function isFile(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isFile()
  } catch {
    return false
  }
}
