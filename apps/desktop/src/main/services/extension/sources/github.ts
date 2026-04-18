import path from 'node:path'
import { app } from 'electron'
import fse from 'fs-extra'
import log from 'electron-log/main'
import type { NetworkService } from '@main/services/network'
import type {
  ExtensionSearchOptions,
  ExtensionSearchResult,
  ExtensionSourceEntry,
  ExtensionSourceProvider
} from '../types'

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

  constructor(private readonly networkService: NetworkService) {}

  async search(query: string, options?: ExtensionSearchOptions): Promise<ExtensionSearchResult> {
    const { page = 1, limit = 20, sortBy = 'stars' } = options ?? {}

    const sortMap: Record<NonNullable<ExtensionSearchOptions['sortBy']>, string> = {
      stars: 'stars',
      updated: 'updated',
      name: 'name'
    }

    let searchQuery = 'topic:kisaki-extension'
    if (query.trim().length > 0) {
      searchQuery += ` ${query.trim()}`
    }

    const url = new URL('https://api.github.com/search/repositories')
    url.searchParams.set('q', searchQuery)
    url.searchParams.set('sort', sortMap[sortBy] ?? 'stars')
    url.searchParams.set('order', 'desc')
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

    const entries = await Promise.all(
      data.items.map(async (repo): Promise<ExtensionSourceEntry | null> => {
        const release = await this.fetchRelease(repo.owner.login, repo.name).catch(() => null)
        const packageAsset = release?.assets.find((asset) => asset.name.endsWith('.kisx'))

        if (!release || !packageAsset) {
          return null
        }

        return {
          id: repo.full_name,
          name: release.name || repo.name,
          version: release.tag_name.replace(/^v/, ''),
          description: repo.description ?? undefined,
          author: repo.owner.login,
          homepage: repo.html_url,
          downloadUrl: packageAsset.browser_download_url,
          provider: this.name,
          locator: `github:${repo.full_name}`,
          iconUrl: `https://raw.githubusercontent.com/${repo.full_name}/main/icon.png`,
          stars: repo.stargazers_count,
          updatedAt: repo.updated_at
        }
      })
    )

    const resolvedEntries = entries.filter(isExtensionSourceEntry)

    return {
      entries: resolvedEntries,
      total: data.total_count,
      hasMore: page * limit < data.total_count
    }
  }

  async resolve(source: string): Promise<ExtensionSourceEntry | null> {
    const parsed = parseGitHubSource(source)
    if (!parsed) {
      return null
    }

    const release = await this.fetchRelease(parsed.owner, parsed.repo, parsed.tag)
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

    const release = await this.fetchRelease(parsed.owner, parsed.repo)
    return release?.tag_name.replace(/^v/, '') ?? null
  }

  async download(entry: ExtensionSourceEntry): Promise<string> {
    const tempDir = path.join(app.getPath('temp'), 'kisaki-extensions')
    const fileName = `extension-${Date.now()}.kisx`
    const destination = path.join(tempDir, fileName)

    await fse.ensureDir(tempDir)
    await this.networkService.downloadToFile(entry.downloadUrl, destination)
    return destination
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

function isExtensionSourceEntry(value: ExtensionSourceEntry | null): value is ExtensionSourceEntry {
  return value !== null
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
