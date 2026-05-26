import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, rm } from 'node:fs/promises'
import archiver from 'archiver'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import type { ExtensionProject } from './project'
import { pathExists, resolvePackageFile } from './project'

export interface CreateArchiveOptions {
  outDir: string
}

const PUBLISH_ARTIFACT_EXTENSIONS = new Set(['.kisx', '.sig'])
const ARCHIVE_ENTRY_DATE = new Date('2000-01-01T00:00:00.000Z')

interface ArchiveEntry {
  readonly filePath: string
  readonly packagePath: string
}

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
  await rm(archivePath, { force: true })

  return new Promise((resolve, reject) => {
    const output = createWriteStream(archivePath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve(archivePath))
    output.on('error', reject)
    archive.on('error', reject)

    archive.pipe(output)
    archive.file(project.manifestPath, { name: 'manifest.json', date: ARCHIVE_ENTRY_DATE })

    void addPackageFiles(project, manifest, archive)
      .then(() => archive.finalize())
      .catch(reject)
  })
}

function shouldIncludeDistEntry(entryName: string): boolean {
  return !PUBLISH_ARTIFACT_EXTENSIONS.has(path.extname(entryName).toLowerCase())
}

async function addPackageFiles(
  project: ExtensionProject,
  manifest: ExtensionManifest,
  archive: archiver.Archiver
): Promise<void> {
  if (await pathExists(project.readmePath)) {
    archive.file(project.readmePath, { name: 'README.md', date: ARCHIVE_ENTRY_DATE })
  }

  if (manifest.icon) {
    const iconPath = resolvePackageFile(project, manifest.icon)
    if (iconPath && (await pathExists(iconPath))) {
      archive.file(iconPath, { name: manifest.icon, date: ARCHIVE_ENTRY_DATE })
    }
  }

  const entries = await collectArchiveEntries(project.distDir, 'dist')
  for (const entry of entries) {
    if (shouldIncludeDistEntry(entry.packagePath)) {
      archive.file(entry.filePath, { name: entry.packagePath, date: ARCHIVE_ENTRY_DATE })
    }
  }
}

async function collectArchiveEntries(rootDir: string, packageDir: string): Promise<ArchiveEntry[]> {
  const entries: ArchiveEntry[] = []
  await collectArchiveEntriesInto(rootDir, packageDir, entries)
  return entries.toSorted((left, right) => compareStrings(left.packagePath, right.packagePath))
}

async function collectArchiveEntriesInto(
  currentDir: string,
  packageDir: string,
  entries: ArchiveEntry[]
): Promise<void> {
  const dirents = (await readdir(currentDir, { withFileTypes: true })).toSorted((left, right) =>
    compareStrings(left.name, right.name)
  )

  for (const dirent of dirents) {
    const filePath = path.join(currentDir, dirent.name)
    const packagePath = path.posix.join(packageDir, dirent.name)

    if (dirent.isDirectory()) {
      await collectArchiveEntriesInto(filePath, packagePath, entries)
      continue
    }

    if (dirent.isFile()) {
      entries.push({ filePath, packagePath })
    }
  }
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1
  }

  if (left > right) {
    return 1
  }

  return 0
}
