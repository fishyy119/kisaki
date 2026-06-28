import path from 'node:path'
import { readdir } from 'node:fs/promises'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import { CliError } from '../../errors'
import type { ExtensionProject } from '../../project'
import { pathExists } from '../../project'

const UI_ENTRY_FILE = 'index.html'
// Normalized form compared against parsed manifests; manifests declare the
// official package-relative style with a ./ prefix.
const EXPECTED_MANIFEST_UI_ROOT = 'dist/ui'
const MANIFEST_UI_DECLARATION = './dist/ui'

export interface ExtensionUiEntry {
  htmlPath: string
  /**
   * Document path relative to the manifest `ui` root, e.g. `settings/index.html`.
   */
  documentPath: string
}

/**
 * Discovers webview document entries: every index.html under src/ui.
 */
export async function discoverUiEntries(
  project: ExtensionProject
): Promise<readonly ExtensionUiEntry[]> {
  if (!(await pathExists(project.uiSourceDir))) {
    return []
  }

  const entries: ExtensionUiEntry[] = []
  await collectUiEntries(project.uiSourceDir, '', entries)
  return entries.toSorted((left, right) =>
    left.documentPath.localeCompare(right.documentPath, 'en')
  )
}

/**
 * Verifies that the manifest `ui` declaration and the src/ui sources agree.
 */
export function assertUiConsistency(
  manifest: ExtensionManifest,
  entries: readonly ExtensionUiEntry[]
): void {
  if (manifest.ui && entries.length === 0) {
    throw new CliError(
      'manifest.json declares "ui" but src/ui contains no index.html webview entries.'
    )
  }

  if (!manifest.ui && entries.length > 0) {
    throw new CliError(
      `src/ui contains webview entries but manifest.json does not declare "ui": "${MANIFEST_UI_DECLARATION}".`
    )
  }

  if (manifest.ui && manifest.ui !== EXPECTED_MANIFEST_UI_ROOT) {
    throw new CliError(
      `manifest.json "ui" must be "${MANIFEST_UI_DECLARATION}"; kisx emits webview assets there.`
    )
  }
}

async function collectUiEntries(
  currentDir: string,
  relativeDir: string,
  entries: ExtensionUiEntry[]
): Promise<void> {
  const dirents = await readdir(currentDir, { withFileTypes: true })

  for (const dirent of dirents) {
    if (dirent.isFile() && dirent.name === UI_ENTRY_FILE) {
      entries.push({
        htmlPath: path.join(currentDir, dirent.name),
        documentPath: relativeDir === '' ? UI_ENTRY_FILE : `${relativeDir}/${UI_ENTRY_FILE}`
      })
      continue
    }

    if (dirent.isDirectory() && !dirent.name.startsWith('.')) {
      await collectUiEntries(
        path.join(currentDir, dirent.name),
        relativeDir === '' ? dirent.name : `${relativeDir}/${dirent.name}`,
        entries
      )
    }
  }
}
