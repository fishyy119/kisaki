import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { unzipSync, type Unzipped } from 'fflate'
import { parseExtensionManifest, type ExtensionManifest } from '@kisaki3/extension-api'
import { CliError } from '../errors'
import { formatValidationIssues } from '../validation'

export interface KisxPackageInfo {
  archivePath: string
  manifest: ExtensionManifest
  size: number
  sha256: string
}

export interface FileDigest {
  size: number
  sha256: string
}

export async function inspectKisxPackage(archivePath: string): Promise<KisxPackageInfo> {
  const resolvedArchivePath = path.resolve(archivePath)
  const [digest, manifest] = await Promise.all([
    hashFile(resolvedArchivePath),
    readKisxArchiveManifest(resolvedArchivePath)
  ])

  return {
    archivePath: resolvedArchivePath,
    manifest,
    size: digest.size,
    sha256: digest.sha256
  }
}

export async function hashFile(filePath: string): Promise<FileDigest> {
  const resolvedFilePath = path.resolve(filePath)
  let fileStat: Awaited<ReturnType<typeof stat>>

  try {
    fileStat = await stat(resolvedFilePath)
  } catch {
    throw new CliError(`File not found: ${resolvedFilePath}`)
  }

  if (!fileStat.isFile()) {
    throw new CliError(`Expected a file: ${resolvedFilePath}`)
  }

  const hash = createHash('sha256')
  for await (const chunk of createReadStream(resolvedFilePath)) {
    hash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return {
    size: fileStat.size,
    sha256: hash.digest('hex')
  }
}

async function readKisxArchiveManifest(archivePath: string): Promise<ExtensionManifest> {
  let archive: Unzipped

  try {
    archive = unzipSync(await readFile(archivePath))
  } catch (error) {
    throw new CliError(
      `Could not read .kisx archive: ${error instanceof Error ? error.message : 'unknown error'}`
    )
  }

  const manifestData = archive['manifest.json']
  if (!manifestData) {
    throw new CliError('Package archive must contain manifest.json at the archive root.')
  }

  let rawManifest: unknown
  try {
    rawManifest = JSON.parse(Buffer.from(manifestData).toString('utf-8'))
  } catch {
    throw new CliError('Package manifest.json contains invalid JSON.')
  }

  const parsed = parseExtensionManifest(rawManifest)
  if (!parsed.manifest) {
    throw new CliError(formatValidationIssues('Package manifest is invalid.', parsed.issues))
  }

  if (!archive[parsed.manifest.entry]) {
    throw new CliError(`Package entry "${parsed.manifest.entry}" was not found in the archive.`)
  }

  if (parsed.manifest.icon && !archive[parsed.manifest.icon]) {
    throw new CliError(`Package icon "${parsed.manifest.icon}" was not found in the archive.`)
  }

  return parsed.manifest
}
