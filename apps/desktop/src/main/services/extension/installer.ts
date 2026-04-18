import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import AdmZip from 'adm-zip'
import fse from 'fs-extra'
import semver from 'semver'
import log from 'electron-log/main'
import type { ExtensionManifest } from '@kisaki/extension-api'
import { parseExtensionManifest, validateInstalledExtensionPackage } from './manifest'
import type {
  ExtensionInstallResult,
  ExtensionServicePaths,
  ExtensionSourceLocator,
  ExtensionUpdateInfo
} from './types'
import type { ExtensionStateStore } from './state'
import type { ExtensionSourceManager } from './sources/manager'

interface PreparedExtensionPackage {
  manifest: ExtensionManifest
  stageDir: string
}

/**
 * Installs, updates, and removes .kisx packages after source resolution.
 */
export class ExtensionInstaller {
  constructor(
    private readonly paths: ExtensionServicePaths,
    private readonly stateStore: ExtensionStateStore,
    private readonly sourceManager: ExtensionSourceManager
  ) {}

  async install(source: string): Promise<ExtensionInstallResult> {
    const resolved = await this.sourceManager.resolve(source)
    if (!resolved) {
      throw new Error(`Cannot resolve extension source: ${source}`)
    }

    return this.installResolvedSource({
      provider: resolved.provider,
      locator: resolved.locator
    })
  }

  async installResolvedSource(source: ExtensionSourceLocator): Promise<ExtensionInstallResult> {
    const resolved = await this.sourceManager.resolve(source.locator, source.provider)
    if (!resolved) {
      throw new Error(`Cannot resolve extension source: ${source.locator}`)
    }

    const archivePath = await this.sourceManager.download(resolved)
    try {
      return await this.installArchive(archivePath, source, false)
    } finally {
      await fse.remove(archivePath).catch(() => undefined)
    }
  }

  async installFromFile(filePath: string): Promise<ExtensionInstallResult> {
    return this.installResolvedSource({
      provider: 'local-file',
      locator: filePath
    })
  }

  async uninstall(extensionId: string): Promise<void> {
    await Promise.all([
      fse.remove(path.join(this.paths.packagesDir, extensionId)),
      fse.remove(path.join(this.paths.dataDir, extensionId)),
      fse.remove(path.join(this.paths.tempDir, extensionId))
    ])

    await this.stateStore.remove(extensionId)
  }

  async checkUpdates(): Promise<readonly ExtensionUpdateInfo[]> {
    const updates: ExtensionUpdateInfo[] = []
    const installed = await this.stateStore.list()

    for (const [extensionId, record] of Object.entries(installed)) {
      if (!record.source) {
        continue
      }

      const latestVersion = await this.sourceManager.getLatestVersion(extensionId, record.source)
      if (!latestVersion || !semver.valid(record.version) || !semver.valid(latestVersion)) {
        continue
      }

      if (semver.gt(latestVersion, record.version)) {
        updates.push({
          extensionId,
          currentVersion: record.version,
          latestVersion,
          source: record.source
        })
      }
    }

    return updates
  }

  async update(extensionId: string): Promise<ExtensionInstallResult | null> {
    const record = await this.stateStore.get(extensionId)
    if (!record?.source) {
      throw new Error(`Extension "${extensionId}" does not have an update source`)
    }

    const latestVersion = await this.sourceManager.getLatestVersion(extensionId, record.source)
    if (!latestVersion || !semver.valid(record.version) || !semver.valid(latestVersion)) {
      return null
    }

    if (!semver.gt(latestVersion, record.version)) {
      return null
    }

    const resolved = await this.sourceManager.resolve(record.source.locator, record.source.provider)
    if (!resolved) {
      throw new Error(`Cannot resolve extension source: ${record.source.locator}`)
    }

    const archivePath = await this.sourceManager.download(resolved)
    try {
      return await this.installArchive(archivePath, record.source, true)
    } finally {
      await fse.remove(archivePath).catch(() => undefined)
    }
  }

  private async installArchive(
    archivePath: string,
    source: ExtensionSourceLocator | null,
    replaceExisting: boolean
  ): Promise<ExtensionInstallResult> {
    const prepared = await this.prepareArchive(archivePath)

    try {
      const targetDir = path.join(this.paths.packagesDir, prepared.manifest.id)
      const existingState = await this.stateStore.get(prepared.manifest.id)

      if (existingState && !replaceExisting) {
        throw new Error(`Extension "${prepared.manifest.id}" is already installed`)
      }

      await Promise.all([
        fse.ensureDir(this.paths.packagesDir),
        fse.ensureDir(path.join(this.paths.dataDir, prepared.manifest.id)),
        fse.ensureDir(path.join(this.paths.tempDir, prepared.manifest.id))
      ])

      await fse.remove(targetDir)
      await fse.move(prepared.stageDir, targetDir, { overwrite: true })

      const now = new Date().toISOString()
      await this.stateStore.set(prepared.manifest.id, {
        enabled: existingState?.enabled ?? true,
        version: prepared.manifest.version,
        source: source ?? existingState?.source ?? null,
        installedAt: existingState?.installedAt ?? now,
        updatedAt: now
      })

      return {
        extensionId: prepared.manifest.id,
        packagePath: targetDir,
        manifest: prepared.manifest
      }
    } catch (error) {
      await fse.remove(prepared.stageDir).catch(() => undefined)
      throw error
    }
  }

  private async prepareArchive(archivePath: string): Promise<PreparedExtensionPackage> {
    const zip = new AdmZip(archivePath)
    const entries = zip.getEntries()
    const manifestEntry = zip.getEntry('manifest.json')

    if (!manifestEntry) {
      throw new Error('Extension package must contain manifest.json at the archive root')
    }

    const parsed = parseExtensionManifest(JSON.parse(manifestEntry.getData().toString('utf-8')))
    if (!parsed.manifest) {
      throw new Error(formatManifestIssues(parsed.issues))
    }

    if (
      parsed.manifest.engines?.kisaki &&
      !semver.satisfies(app.getVersion(), parsed.manifest.engines.kisaki)
    ) {
      throw new Error(
        `Extension "${parsed.manifest.id}" requires Kisaki ${parsed.manifest.engines.kisaki}, current version is ${app.getVersion()}`
      )
    }

    const normalizedEntryNames = new Set(
      entries
        .filter((entry) => !entry.isDirectory)
        .map((entry) => normalizeArchiveEntry(entry.entryName))
        .filter((entryName): entryName is string => entryName !== null)
    )

    if (!normalizedEntryNames.has(parsed.manifest.entry)) {
      throw new Error(`Extension entry "${parsed.manifest.entry}" was not found in the package`)
    }

    if (parsed.manifest.icon && !normalizedEntryNames.has(parsed.manifest.icon)) {
      throw new Error(`Extension icon "${parsed.manifest.icon}" was not found in the package`)
    }

    const stageDir = path.join(
      this.paths.tempDir,
      '.install',
      `${parsed.manifest.id}-${randomUUID()}`
    )
    await fse.ensureDir(stageDir)

    for (const entry of entries) {
      if (entry.isDirectory) {
        continue
      }

      const normalizedEntry = normalizeArchiveEntry(entry.entryName)
      if (!normalizedEntry) {
        throw new Error(`Package entry "${entry.entryName}" is outside the archive root`)
      }

      const targetPath = path.resolve(stageDir, normalizedEntry)
      const relative = path.relative(stageDir, targetPath)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Package entry "${entry.entryName}" escapes the install directory`)
      }

      await fse.ensureDir(path.dirname(targetPath))
      await fse.writeFile(targetPath, entry.getData())
    }

    const packageIssues = await validateInstalledExtensionPackage(stageDir, parsed.manifest)
    if (packageIssues.length > 0) {
      throw new Error(formatManifestIssues(packageIssues))
    }

    log.info(`[ExtensionInstaller] Prepared package ${parsed.manifest.id} from ${archivePath}`)
    return {
      manifest: parsed.manifest,
      stageDir
    }
  }
}

function normalizeArchiveEntry(entryName: string): string | null {
  const normalized = path.posix.normalize(entryName.replace(/\\/g, '/'))
  if (
    !normalized ||
    normalized === '.' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    return null
  }

  return normalized.startsWith('./') ? normalized.slice(2) : normalized
}

function formatManifestIssues(issues: readonly { path: string; message: string }[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')
}
