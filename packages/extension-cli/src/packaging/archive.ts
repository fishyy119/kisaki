import path from 'node:path'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { zipSync, type Zippable } from 'fflate'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import type { ExtensionProject } from '../project'
import { collectExtensionPackageFileEntries, copyExtensionPackageFiles } from './layout'

export interface CreateArchiveOptions {
  outDir: string
}

// Fixed metadata keeps .kisx archives byte-for-byte reproducible.
const ARCHIVE_ENTRY_DATE = new Date('2000-01-01T00:00:00.000Z')
const ARCHIVE_ENTRY_UNIX_ATTRIBUTES = 0o644 << 16
const ARCHIVE_UNIX_OS = 3

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

    const zippable: Zippable = {}
    for (const entry of entries) {
      zippable[entry.packagePath] = [
        await readFile(entry.filePath),
        { mtime: ARCHIVE_ENTRY_DATE, attrs: ARCHIVE_ENTRY_UNIX_ATTRIBUTES, os: ARCHIVE_UNIX_OS }
      ]
    }

    await writeFile(archivePath, zipSync(zippable, { level: 9, mtime: ARCHIVE_ENTRY_DATE }))
    return archivePath
  } catch (error) {
    await rm(archivePath, { force: true }).catch(() => undefined)
    throw error
  } finally {
    await rm(tempPackagePath, { recursive: true, force: true }).catch(() => undefined)
  }
}
