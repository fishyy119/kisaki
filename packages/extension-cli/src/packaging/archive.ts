import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { once } from 'node:events'
import { mkdir, readFile, rm } from 'node:fs/promises'
import archiver from 'archiver'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import type { ExtensionProject } from '../project'
import { collectExtensionPackageFileEntries, copyExtensionPackageFiles } from './layout'

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

async function writeArchive(
  archivePath: string,
  entries: readonly { filePath: string; packagePath: string }[]
): Promise<string> {
  const output = createWriteStream(archivePath)
  const archive = archiver('zip', { zlib: { level: 9 } })
  const completed = new Promise<void>((resolve, reject) => {
    output.once('close', resolve)
    output.once('error', (error) => {
      archive.abort()
      reject(error)
    })
    archive.once('error', reject)
  })

  archive.pipe(output)

  try {
    for (const entry of entries) {
      const processed = once(archive, 'entry')
      archive.append(await readFile(entry.filePath), {
        name: entry.packagePath,
        date: ARCHIVE_ENTRY_DATE,
        mode: 0o644
      })
      await Promise.race([processed, completed])
    }

    await archive.finalize()
    await completed
    return archivePath
  } catch (error) {
    archive.abort()
    output.destroy()
    await rm(archivePath, { force: true })
    throw error
  }
}
