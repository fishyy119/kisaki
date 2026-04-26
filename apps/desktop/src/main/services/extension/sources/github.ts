import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import fse from 'fs-extra'
import log from 'electron-log/main'
import type { NetworkService } from '@main/services/network'
import type {
  ExtensionDiscoveryEntry,
  ExtensionSearchOptions,
  ExtensionSearchResult,
  ExtensionSourceEntry,
  ExtensionSourceProvider
} from '../types'
import { resolveInsideRoot } from '../shared/path-confinement'

interface GitHubReleaseAsset {
  name: string
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  name: string
  body: string | null
  assets: GitHubReleaseAsset[]
}

interface GitHubRepo {
  full_name: string
  name: string
  owner: { login: string }
  description: string | null
  html_url: string
  stargazers_count: number
  updated_at: string
}

interface GitHubSearchResponse {
  total_count: number
  items: GitHubRepo[]
}

/**
 * Resolves and downloads .kisx packages from GitHub releases.
 */
export class GitHubExtensionSourceProvider implements ExtensionSourceProvider {
  readonly name = 'github'
  readonly displayName = 'GitHub'
  readonly searchable = true
  private readonly releaseCache = new Map<
    string,
    { expiresAt: number; value: Promise<GitHubRelease | null> }
  >()
  private readonly releaseCacheTtlMs = 5 * 60_000

  constructor(private readonly networkService: NetworkService) {}

  async search(query: string, options?: ExtensionSearchOptions): Promise<ExtensionSearchResult> {
    const { page = 1, limit = 20, sortBy = 'stars', sortDirection = 'desc' } = options ?? {}

    const sortMap: Record<NonNullable<ExtensionSearchOptions['sortBy']>, string | null> = {
      stars: 'stars',
      updated: 'updated',
      name: null
    }

    let searchQuery = 'topic:kisaki-extension'
    if (query.trim().length > 0) {
      searchQuery += ` ${query.trim()}`
    }

    const url = new URL('https://api.github.com/search/repositories')
    url.searchParams.set('q', searchQuery)
    const remoteSort = sortMap[sortBy] ?? 'stars'
    if (remoteSort) {
      url.searchParams.set('sort', remoteSort)
      url.searchParams.set('order', sortDirection)
    }
    url.searchParams.set('per_page', String(limit))
    url.searchParams.set('page', String(page))

    const response = await this.networkService.fetch(url.toString(), {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Kisaki-Extension-Manager'
      }
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as GitHubSearchResponse

    return {
      entries: data.items.map((repo) => this.toDiscoveryEntry(repo)),
      total: data.total_count,
      hasMore: page * limit < data.total_count
    }
  }

  async resolve(source: string): Promise<ExtensionSourceEntry | null> {
    const parsed = parseGitHubSource(source)
    if (!parsed) {
      return null
    }

    const release = await this.getRelease(parsed.owner, parsed.repo, parsed.tag)
    if (!release) {
      return null
    }

    const packageAsset = release.assets.find((asset) => asset.name.endsWith('.kisx'))
    if (!packageAsset) {
      log.warn(`[GitHubExtensionSource] No .kisx asset found for ${source}`)
      return null
    }

    return {
      id: `${parsed.owner}/${parsed.repo}`,
      name: release.name || parsed.repo,
      version: release.tag_name.replace(/^v/, ''),
      description: release.body?.slice(0, 280) ?? undefined,
      homepage: `https://github.com/${parsed.owner}/${parsed.repo}`,
      downloadUrl: packageAsset.browser_download_url,
      provider: this.name,
      locator: source
    }
  }

  async getLatestVersion(_extensionId: string, source: string): Promise<string | null> {
    const parsed = parseGitHubSource(source)
    if (!parsed || parsed.tag) {
      return null
    }

    const release = await this.getRelease(parsed.owner, parsed.repo)
    return release?.tag_name.replace(/^v/, '') ?? null
  }

  async download(entry: ExtensionSourceEntry): Promise<string> {
    const tempDir = resolveInsideRoot(app.getPath('temp'), 'kisaki-extensions')
    const fileName = `${randomUUID()}.kisx`
    const destination = resolveInsideRoot(tempDir, fileName)

    await fse.ensureDir(tempDir)
    await this.networkService.downloadToFile(entry.downloadUrl, destination)
    return destination
  }

  private toDiscoveryEntry(repo: GitHubRepo): ExtensionDiscoveryEntry {
    return {
      id: repo.full_name,
      name: repo.name,
      version: null,
      description: repo.description ?? undefined,
      author: repo.owner.login,
      homepage: repo.html_url,
      provider: this.name,
      locator: `github:${repo.full_name}`,
      stars: repo.stargazers_count,
      updatedAt: repo.updated_at
    }
  }

  private getRelease(owner: string, repo: string, tag?: string): Promise<GitHubRelease | null> {
    const cacheKey = tag ? `${owner}/${repo}@${tag}` : `${owner}/${repo}@latest`
    const cached = this.releaseCache.get(cacheKey)
    const now = Date.now()
    if (cached && cached.expiresAt > now) {
      return cached.value
    }

    const value = this.fetchRelease(owner, repo, tag).catch((error) => {
      const active = this.releaseCache.get(cacheKey)
      if (active?.value === value) {
        this.releaseCache.delete(cacheKey)
      }
      throw error
    })

    this.releaseCache.set(cacheKey, {
      expiresAt: now + this.releaseCacheTtlMs,
      value
    })

    return value
  }

  private async fetchRelease(
    owner: string,
    repo: string,
    tag?: string
  ): Promise<GitHubRelease | null> {
    const url = tag
      ? `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`
      : `https://api.github.com/repos/${owner}/${repo}/releases/latest`

    const response = await this.networkService.fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Kisaki-Extension-Manager'
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }

      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    return (await response.json()) as GitHubRelease
  }
}

function parseGitHubSource(source: string): { owner: string; repo: string; tag?: string } | null {
  if (!source.startsWith('github:')) {
    return null
  }

  const locator = source.slice('github:'.length)
  const [ownerRepo, tag] = locator.split('@', 2)
  const parts = ownerRepo.split('/')

  if (parts.length !== 2 || parts.some((part) => part.trim().length === 0)) {
    return null
  }

  return {
    owner: parts[0],
    repo: parts[1],
    tag
  }
}
