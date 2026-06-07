import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import archiver from 'archiver'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import type { ExtensionProject } from './project'
import { collectExtensionPackageFileEntries, copyExtensionPackageFiles } from './package-layout'

export interface CreateArchiveOptions {
  outDir: string
}

const ARCHIVE_ENTRY_DATE = new Date('2000-01-01T00:00:00.000Z')

/**
 * Creates a .kisx archive using the official extension package layout.
 */
export async function createKisxArchive(
  project: ExtensionProject,
  manifest: ExtensionManifest,
  options: CreateArchiveOptions
): Promise<string> {
  const outDir = path.resolve(project.rootDir, options.outDir)
  await mkdir(outDir, { recursive: true })

  const archivePath = path.join(outDir, `${manifest.id}-${manifest.version}.kisx`)
  const tempPackagePath = path.join(outDir, `.${manifest.id}.pack-${process.pid}-${Date.now()}`)
  await rm(archivePath, { force: true })
  await rm(tempPackagePath, { recursive: true, force: true })
  await mkdir(tempPackagePath, { recursive: true })

  try {
    await copyExtensionPackageFiles(project, manifest, tempPackagePath)
    const entries = await collectExtensionPackageFileEntries(tempPackagePath)

    return await writeArchive(archivePath, entries)
  } finally {
    await rm(tempPackagePath, { recursive: true, force: true }).catch(() => undefined)
  }
}

function writeArchive(
  archivePath: string,
  entries: readonly { filePath: string; packagePath: string }[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(archivePath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve(archivePath))
    output.on('error', reject)
    archive.on('error', reject)

    archive.pipe(output)

    for (const entry of entries) {
      archive.file(entry.filePath, { name: entry.packagePath, date: ARCHIVE_ENTRY_DATE })
    }

    void archive.finalize().catch(reject)
  })
}
