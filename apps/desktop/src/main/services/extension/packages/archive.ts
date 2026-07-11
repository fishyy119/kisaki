import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { movePath, pathExists } from '@main/utils/fs'
import type { ExtensionPackageLayout } from './layout'
import { requireSafeArchiveSha256 } from './layout'
import { hashFile } from './verifier'
import { resolveInsideRoot } from '../shared/path-confinement'

const ARCHIVE_FILE_PATTERN = /^([a-f0-9]{64})\.kisx$/

export class ExtensionPackageArchiveStore {
  constructor(private readonly layout: ExtensionPackageLayout) {}

  archivePath(sha256: string): string {
    return this.layout.archivePath(sha256)
  }

  async storeArchive(input: { archivePath: string; sha256: string }): Promise<string> {
    const sha256 = requireSafeArchiveSha256(input.sha256)
    const targetPath = this.archivePath(sha256)
    const tempPath = resolveInsideRoot(this.layout.archivesDir, `${sha256}.${randomUUID()}.tmp`)

    await mkdir(this.layout.archivesDir, { recursive: true })
    try {
      await cp(input.archivePath, tempPath, { force: true })
      const copied = await hashFile(tempPath)
      if (copied.sha256 !== sha256) {
        throw new Error(`Stored extension package archive sha256 mismatch for "${sha256}".`)
      }

      await movePath(tempPath, targetPath, { overwrite: true })
      return targetPath
    } finally {
      await rm(tempPath, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  async requireArchive(sha256: string): Promise<string> {
    const archivePath = this.archivePath(sha256)
    if (!(await pathExists(archivePath))) {
      throw new Error(`extension package archive "${sha256}" is missing`)
    }

    return archivePath
  }

  async pruneUnusedArchives(
    retainedSha256s: ReadonlySet<string>,
    onPruned: (entryPath: string) => void
  ): Promise<void> {
    await mkdir(this.layout.archivesDir, { recursive: true })
    const entries = await readdir(this.layout.archivesDir, { withFileTypes: true })

    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(this.layout.archivesDir, entry.name)
        const match = entry.isFile() ? ARCHIVE_FILE_PATTERN.exec(entry.name) : null
        if (match?.[1] && retainedSha256s.has(match[1])) {
          return
        }

        await rm(entryPath, { recursive: true, force: true })
        onPruned(entryPath)
      })
    )
  }
}
