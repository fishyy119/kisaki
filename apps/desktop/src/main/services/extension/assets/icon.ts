import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { mkdir, rm, stat } from 'node:fs/promises'
import { movePath } from '@main/utils/fs'
import { createLogger } from '@main/log'
import { net } from 'electron'
import { EXTENSION_ICON_SCHEME } from '@main/bootstrap/protocol'
import type { NetworkService } from '@main/services/network'
import type { ExtensionRegistryPackageIcon } from '@kisaki3/extension-registry'
import { resolveInsideRoot } from '@shared/extension/path-confinement'
import { createProtocolHandlerSlot } from '@main/utils/protocol-slot'
import { hashFile } from '../packages/verifier'

const log = createLogger('Extension')

const MAX_EXTENSION_ICON_BYTES = 5 * 1024 * 1024
const EXTENSION_ICON_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ICON_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'])
const ICON_CACHE_KEY_PATTERN = /^[a-f0-9]{64}$/

const extensionIconProtocolSlot = createProtocolHandlerSlot(
  EXTENSION_ICON_SCHEME,
  'Extension icon service unavailable'
)

export class ExtensionIconManager {
  readonly cacheDir: string
  private iconsByCacheKey = new Map<string, ExtensionRegistryPackageIcon>()
  private readonly iconSources = new Map<string, Map<string, ExtensionRegistryPackageIcon>>()
  private readonly downloadsByCacheKey = new Map<string, Promise<string>>()
  private readonly verifiedCacheKeys = new Set<string>()

  constructor(
    rootDir: string,
    private readonly networkService: NetworkService
  ) {
    this.cacheDir = resolveInsideRoot(rootDir, 'cache', 'icons')
  }

  registerProtocolHandler(): void {
    extensionIconProtocolSlot.activate((request) => this.serveIconRequest(request))
  }

  setAvailableIcons(
    source: string,
    icons: Iterable<ExtensionRegistryPackageIcon | null | undefined>
  ): void {
    const sourceIcons = new Map<string, ExtensionRegistryPackageIcon>()
    for (const icon of icons) {
      if (!icon) {
        continue
      }
      sourceIcons.set(this.cacheKey(icon), icon)
    }

    if (sourceIcons.size === 0) {
      this.iconSources.delete(source)
    } else {
      this.iconSources.set(source, sourceIcons)
    }
    this.rebuildAvailableIcons()
  }

  getIconUrl(icon: ExtensionRegistryPackageIcon | null | undefined): string | null {
    if (!icon) {
      return null
    }

    return `${EXTENSION_ICON_SCHEME}://${this.cacheKey(icon)}/icon${getIconExtension(icon.url)}`
  }

  private async serveIconRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url)
      const cacheKey = url.hostname.toLowerCase()
      if (!ICON_CACHE_KEY_PATTERN.test(cacheKey)) {
        return new Response('Invalid extension icon key', { status: 400 })
      }

      const icon = this.iconsByCacheKey.get(cacheKey)
      if (!icon) {
        return new Response('Extension icon not found', { status: 404 })
      }

      const filePath = await this.getOrDownloadIcon(icon)
      return await net.fetch(pathToFileURL(filePath).toString())
    } catch (error) {
      log.warn('Failed to serve extension icon:', error)
      return new Response('Failed to load extension icon', { status: 500 })
    }
  }

  private async getOrDownloadIcon(icon: ExtensionRegistryPackageIcon): Promise<string> {
    const cacheKey = this.cacheKey(icon)
    const targetPath = this.cachePath(icon)
    if (await this.hasValidCachedIcon(icon, cacheKey, targetPath)) {
      return targetPath
    }

    const existingDownload = this.downloadsByCacheKey.get(cacheKey)
    if (existingDownload) {
      return existingDownload
    }

    const download = this.downloadIcon(icon)
      .then(() => targetPath)
      .finally(() => {
        this.downloadsByCacheKey.delete(cacheKey)
      })
    this.downloadsByCacheKey.set(cacheKey, download)
    return download
  }

  private async downloadIcon(icon: ExtensionRegistryPackageIcon): Promise<void> {
    const cacheKey = this.cacheKey(icon)
    const targetPath = this.cachePath(icon)
    if (await this.hasValidCachedIcon(icon, cacheKey, targetPath)) {
      return
    }

    const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`
    await mkdir(this.cacheDir, { recursive: true })
    await rm(tempPath, { recursive: true, force: true }).catch(() => undefined)

    try {
      await this.networkService.download.toFile(icon.url, tempPath, {
        retries: 0,
        timeout: 10000,
        maxBytes: MAX_EXTENSION_ICON_BYTES
      })

      if (icon.sha256) {
        const fileInfo = await hashFile(tempPath)
        if (fileInfo.sha256 !== icon.sha256) {
          throw new Error('Icon sha256 checksum mismatch.')
        }
      }

      await movePath(tempPath, targetPath, { overwrite: true })
      if (icon.sha256) {
        this.verifiedCacheKeys.add(cacheKey)
      }
    } catch (error) {
      await rm(tempPath, { recursive: true, force: true }).catch(() => undefined)
      throw error
    }
  }

  private async hasValidCachedIcon(
    icon: ExtensionRegistryPackageIcon,
    cacheKey: string,
    filePath: string
  ): Promise<boolean> {
    const fileStat = await stat(filePath).catch(() => null)
    if (!fileStat?.isFile()) {
      return false
    }

    if (Date.now() - fileStat.mtimeMs > EXTENSION_ICON_CACHE_TTL_MS) {
      this.verifiedCacheKeys.delete(cacheKey)
      await rm(filePath, { recursive: true, force: true }).catch(() => undefined)
      return false
    }

    if (!icon.sha256 || this.verifiedCacheKeys.has(cacheKey)) {
      return true
    }

    const fileInfo = await hashFile(filePath)
    if (fileInfo.sha256 === icon.sha256) {
      this.verifiedCacheKeys.add(cacheKey)
      return true
    }

    await rm(filePath, { recursive: true, force: true }).catch(() => undefined)
    return false
  }

  private cacheKey(icon: ExtensionRegistryPackageIcon): string {
    return createHash('sha256')
      .update(`${icon.url}\n${icon.sha256 ?? ''}`)
      .digest('hex')
  }

  private cachePath(icon: ExtensionRegistryPackageIcon): string {
    return resolveInsideRoot(this.cacheDir, `${this.cacheKey(icon)}${getIconExtension(icon.url)}`)
  }

  private rebuildAvailableIcons(): void {
    const nextIcons = new Map<string, ExtensionRegistryPackageIcon>()
    for (const sourceIcons of this.iconSources.values()) {
      for (const [cacheKey, icon] of sourceIcons) {
        nextIcons.set(cacheKey, icon)
      }
    }
    this.iconsByCacheKey = nextIcons
  }
}

function getIconExtension(url: string): string {
  try {
    const extension = path.extname(new URL(url).pathname).toLowerCase()
    return ICON_EXTENSIONS.has(extension) ? extension : '.img'
  } catch {
    return '.img'
  }
}
