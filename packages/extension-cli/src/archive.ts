import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import archiver from 'archiver'
import type { ExtensionManifest } from '@kisaki/extension-api'
import type { ExtensionProject } from './project'
import { pathExists, resolvePackageFile } from './project'

export interface CreateArchiveOptions {
  outDir: string
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
    archive.file(project.manifestPath, { name: 'manifest.json' })
    archive.directory(project.distDir, 'dist')

    void addOptionalFiles(project, manifest, archive)
      .then(() => archive.finalize())
      .catch(reject)
  })
}

async function addOptionalFiles(
  project: ExtensionProject,
  manifest: ExtensionManifest,
  archive: archiver.Archiver
): Promise<void> {
  if (await pathExists(project.readmePath)) {
    archive.file(project.readmePath, { name: 'README.md' })
  }

  if (manifest.icon) {
    const iconPath = resolvePackageFile(project, manifest.icon)
    if (iconPath && (await pathExists(iconPath))) {
      archive.file(iconPath, { name: manifest.icon })
    }
  }
}
