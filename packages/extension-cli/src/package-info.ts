import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { parseExtensionManifest, type ExtensionManifest } from '@kisaki3/extension-api'
import { CliError } from './logger'

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

function readKisxArchiveManifest(archivePath: string): ExtensionManifest {
  let zip: AdmZip

  try {
    zip = new AdmZip(archivePath)
  } catch (error) {
    throw new CliError(
      `Could not read .kisx archive: ${error instanceof Error ? error.message : 'unknown error'}`
    )
  }

  const manifestEntry = zip.getEntry('manifest.json')
  if (!manifestEntry) {
    throw new CliError('Package archive must contain manifest.json at the archive root.')
  }

  let rawManifest: unknown
  try {
    rawManifest = JSON.parse(manifestEntry.getData().toString('utf-8'))
  } catch {
    throw new CliError('Package manifest.json contains invalid JSON.')
  }

  const parsed = parseExtensionManifest(rawManifest)
  if (!parsed.manifest) {
    throw new CliError(formatIssues('Package manifest is invalid.', parsed.issues))
  }

  if (!zip.getEntry(parsed.manifest.entry)) {
    throw new CliError(`Package entry "${parsed.manifest.entry}" was not found in the archive.`)
  }

  if (parsed.manifest.icon && !zip.getEntry(parsed.manifest.icon)) {
    throw new CliError(`Package icon "${parsed.manifest.icon}" was not found in the archive.`)
  }

  return parsed.manifest
}

function formatIssues(title: string, issues: readonly { path: string; message: string }[]): string {
  return [title, ...issues.map((issue) => `${issue.path}: ${issue.message}`)].join('\n')
}
