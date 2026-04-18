import path from 'node:path'
import { app } from 'electron'
import fse from 'fs-extra'
import AdmZip from 'adm-zip'
import type {
  ExtensionSourceProvider,
  ExtensionSearchOptions,
  ExtensionSearchResult,
  ExtensionSourceEntry
} from '../types'
import { parseExtensionManifest } from '../manifest'

/**
 * Resolves local .kisx files for manual installation workflows.
 */
export class LocalFileExtensionSourceProvider implements ExtensionSourceProvider {
  readonly name = 'local-file'
  readonly displayName = 'Local File'
  readonly searchable = false

  async search(_query: string, _options?: ExtensionSearchOptions): Promise<ExtensionSearchResult> {
    return {
      entries: [],
      total: 0,
      hasMore: false
    }
  }

  async resolve(source: string): Promise<ExtensionSourceEntry | null> {
    if (!isLocalPackagePath(source)) {
      return null
    }

    const resolvedPath = path.resolve(source)
    if (!(await fse.pathExists(resolvedPath))) {
      return null
    }

    const stat = await fse.stat(resolvedPath)
    if (!stat.isFile() || path.extname(resolvedPath).toLowerCase() !== '.kisx') {
      return null
    }

    const zip = new AdmZip(resolvedPath)
    const manifestEntry = zip.getEntry('manifest.json')
    if (!manifestEntry) {
      return null
    }

    const parsed = parseExtensionManifest(JSON.parse(manifestEntry.getData().toString('utf-8')))
    if (!parsed.manifest) {
      return null
    }

    return {
      id: parsed.manifest.id,
      name: parsed.manifest.name,
      version: parsed.manifest.version,
      description: parsed.manifest.description,
      author: parsed.manifest.author,
      homepage: parsed.manifest.homepage,
      categories: parsed.manifest.categories,
      downloadUrl: resolvedPath,
      provider: this.name,
      locator: resolvedPath
    }
  }

  async getLatestVersion(_extensionId: string, _source: string): Promise<string | null> {
    return null
  }

  async download(entry: ExtensionSourceEntry): Promise<string> {
    const tempDir = path.join(app.getPath('temp'), 'kisaki-extensions')
    const destination = path.join(tempDir, `extension-${Date.now()}.kisx`)

    await fse.ensureDir(tempDir)
    await fse.copy(entry.downloadUrl, destination, { overwrite: true })
    return destination
  }
}

function isLocalPackagePath(source: string): boolean {
  if (source.startsWith('github:')) {
    return false
  }

  return (
    path.isAbsolute(source) ||
    source.startsWith('./') ||
    source.startsWith('../') ||
    source.toLowerCase().endsWith('.kisx')
  )
}
