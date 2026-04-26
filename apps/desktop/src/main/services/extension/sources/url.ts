import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import fse from 'fs-extra'
import type { NetworkService } from '@main/services/network'
import type {
  ExtensionSearchOptions,
  ExtensionSearchResult,
  ExtensionSourceEntry,
  ExtensionSourceProvider
} from '../types'
import { resolveInsideRoot } from '../shared/path-confinement'

/**
 * Resolves direct HTTP(S) extension package URLs.
 */
export class UrlExtensionSourceProvider implements ExtensionSourceProvider {
  readonly name = 'url'
  readonly displayName = 'URL'
  readonly searchable = false

  constructor(private readonly networkService: NetworkService) {}

  async search(_query: string, _options?: ExtensionSearchOptions): Promise<ExtensionSearchResult> {
    return {
      entries: [],
      total: 0,
      hasMore: false
    }
  }

  async resolve(source: string): Promise<ExtensionSourceEntry | null> {
    const url = parsePackageUrl(source)
    if (!url) {
      return null
    }

    return {
      id: url.toString(),
      name: inferPackageName(url),
      version: '0.0.0',
      downloadUrl: url.toString(),
      provider: this.name,
      locator: url.toString()
    }
  }

  async getLatestVersion(_extensionId: string, _source: string): Promise<string | null> {
    return null
  }

  async download(entry: ExtensionSourceEntry): Promise<string> {
    const tempDir = resolveInsideRoot(app.getPath('temp'), 'kisaki-extensions')
    const destination = resolveInsideRoot(tempDir, `${randomUUID()}.kisx`)

    await fse.ensureDir(tempDir)
    await this.networkService.downloadToFile(entry.downloadUrl, destination)
    return destination
  }
}

function parsePackageUrl(source: string): URL | null {
  try {
    const url = new URL(source.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }

    return url
  } catch {
    return null
  }
}

function inferPackageName(url: URL): string {
  const fileName = path.posix.basename(url.pathname)
  if (!fileName || fileName === '/') {
    return url.hostname
  }

  try {
    return decodeURIComponent(fileName).replace(/\.kisx$/i, '') || url.hostname
  } catch {
    return fileName.replace(/\.kisx$/i, '') || url.hostname
  }
}
