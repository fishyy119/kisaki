import { randomUUID } from 'node:crypto'
import { link, mkdir, open, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import type { ExtensionRegistryManifest } from '@kisaki3/extension-registry'
import { CliError } from '../errors'
import { readJsonFile } from '../project'
import { assertValidRegistryManifest, type RegistryManifestValidationOptions } from './manifest'

/** Reads and validates a registry manifest file. */
export async function readRegistryManifestFile(
  manifestPath: string,
  options: RegistryManifestValidationOptions = {}
): Promise<ExtensionRegistryManifest> {
  const resolvedManifestPath = path.resolve(manifestPath)
  let raw: unknown
  try {
    raw = await readJsonFile(resolvedManifestPath)
  } catch (error) {
    throw new CliError(
      `Could not read registry manifest: ${error instanceof Error ? error.message : 'unknown error'}`
    )
  }

  return assertValidRegistryManifest(raw, options)
}

/** Atomically writes a consistently formatted JSON document. */
export async function writeJsonDocument(
  filePath: string,
  value: unknown,
  options: { mode: 'create' | 'replace' }
): Promise<void> {
  const targetPath = path.resolve(filePath)
  const targetDir = path.dirname(targetPath)
  const tempPath = path.join(
    targetDir,
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`
  )

  await mkdir(targetDir, { recursive: true })

  try {
    const handle = await open(tempPath, 'wx')
    try {
      await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }

    if (options.mode === 'create') {
      // A hard link publishes the complete file only when the target does not exist.
      await link(tempPath, targetPath)
    } else {
      await rename(tempPath, targetPath)
    }
  } catch (error) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      throw new CliError(`File already exists: ${targetPath}`)
    }
    throw error
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined)
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
