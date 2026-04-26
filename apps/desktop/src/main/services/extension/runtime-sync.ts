import path from 'node:path'
import fse from 'fs-extra'
import log from 'electron-log/main'
import type { ExtensionRuntimeMetadata } from '@kisaki/extension-api'
import { getBootstrapArgs } from '@main/bootstrap/args'
import type { ExtensionCatalogEntry, ExtensionServicePaths } from './types'
import { createExtensionRuntimeMetadata } from './types'
import { readExtensionManifestFile, validateInstalledExtensionPackage } from './manifest'
import type { ExtensionReloadWatcher } from './reload-watcher'

export async function resolveDevExtension(
  paths: ExtensionServicePaths
): Promise<ExtensionRuntimeMetadata | null> {
  const devExtensionPath = getBootstrapArgs().devExtension
  if (!devExtensionPath) {
    return null
  }

  const extensionPath = path.resolve(devExtensionPath)
  const manifestPath = path.join(extensionPath, 'manifest.json')

  try {
    const parsed = await readExtensionManifestFile(manifestPath)
    if (!parsed.manifest) {
      throw new Error(parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
    }

    const packageIssues = await validateInstalledExtensionPackage(extensionPath, parsed.manifest)
    if (packageIssues.length > 0) {
      throw new Error(packageIssues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
    }

    const dataPath = path.join(paths.dataDir, parsed.manifest.id)
    const tempPath = path.join(paths.tempDir, parsed.manifest.id)
    await Promise.all([fse.ensureDir(dataPath), fse.ensureDir(tempPath)])

    log.info(
      `[ExtensionService] Registered dev extension override: ${parsed.manifest.id} -> ${extensionPath}`
    )

    return {
      id: parsed.manifest.id,
      name: parsed.manifest.name,
      version: parsed.manifest.version,
      manifestPath,
      extensionPath,
      dataPath,
      tempPath,
      mode: 'development'
    }
  } catch (error) {
    log.error('[ExtensionService] Failed to load --dev-extension package:', error)
    return null
  }
}

export function buildDesiredRuntimeMap(
  snapshot: readonly ExtensionCatalogEntry[],
  devExtension: ExtensionRuntimeMetadata | null
): Map<string, ExtensionRuntimeMetadata> {
  const desired = new Map<string, ExtensionRuntimeMetadata>()

  for (const entry of snapshot) {
    if (!entry.enabled || entry.status !== 'ready' || !entry.manifest) {
      continue
    }

    desired.set(entry.id, createExtensionRuntimeMetadata(entry))
  }

  if (devExtension) {
    desired.set(devExtension.id, devExtension)
  }

  return desired
}

export async function syncReloadWatcherTargets(
  reloadWatcher: ExtensionReloadWatcher,
  desired: ReadonlyMap<string, ExtensionRuntimeMetadata> | readonly ExtensionRuntimeMetadata[]
): Promise<void> {
  const metadataList = [...desired.values()]

  await reloadWatcher.updateTargets(
    metadataList.map((metadata) => ({
      extensionId: metadata.id,
      extensionPath: metadata.extensionPath
    }))
  )
}
