import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import fse from 'fs-extra'
import type { NetworkService } from '@main/services/network'
import {
  parseExtensionRegistryManifest,
  type ExtensionRegistryManifest
} from '@kisaki/extension-registry'
import { stringifyExtensionRegistryCanonicalJson } from '@kisaki/extension-registry/node'

const MAX_REGISTRY_MANIFEST_BYTES = 2 * 1024 * 1024

export interface ExtensionRepositoryFetchOptions {
  etag?: string | null
  lastModified?: string | null
  signal?: AbortSignal
}

export type ExtensionRepositoryFetchResult =
  | {
      status: 'success'
      manifest: ExtensionRegistryManifest
      manifestDigest: string
      etag: string | null
      lastModified: string | null
    }
  | {
      status: 'not-modified'
      etag: string | null
      lastModified: string | null
    }

export interface ExtensionRepositoryFetcherOptions {
  allowInsecureLocalUrls?: boolean
}

export class ExtensionRepositoryFetcher {
  constructor(
    private readonly networkService: NetworkService,
    private readonly options: ExtensionRepositoryFetcherOptions = {}
  ) {}

  async fetch(
    manifestUrl: string,
    options: ExtensionRepositoryFetchOptions = {}
  ): Promise<ExtensionRepositoryFetchResult> {
    const parsedUrl = new URL(manifestUrl)

    if (parsedUrl.protocol === 'file:') {
      const manifest = await this.fetchLocalFileManifest(parsedUrl)
      return {
        status: 'success',
        manifest,
        manifestDigest: createManifestDigest(manifest),
        etag: null,
        lastModified: null
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json'
    }
    if (options.etag) {
      headers['If-None-Match'] = options.etag
    }
    if (options.lastModified) {
      headers['If-Modified-Since'] = options.lastModified
    }

    const response = await this.networkService.request.fetch(manifestUrl, {
      headers,
      timeout: 15000,
      retries: 1,
      signal: options.signal
    })

    if (response.status === 304) {
      return {
        status: 'not-modified',
        etag: response.headers.get('etag') ?? options.etag ?? null,
        lastModified: response.headers.get('last-modified') ?? options.lastModified ?? null
      }
    }

    if (!response.ok) {
      throw new Error(`Repository fetch failed: ${response.status} ${response.statusText}`)
    }

    const text = await readResponseTextWithLimit(response, MAX_REGISTRY_MANIFEST_BYTES)
    const manifest = parseManifestJson(text, this.options.allowInsecureLocalUrls)

    return {
      status: 'success',
      manifest,
      manifestDigest: createManifestDigest(manifest),
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified')
    }
  }

  private async fetchLocalFileManifest(url: URL): Promise<ExtensionRegistryManifest> {
    if (!this.options.allowInsecureLocalUrls) {
      throw new Error('Local repository manifest files are only allowed in development mode.')
    }

    const filePath = fileURLToPath(url)
    const stat = await fse.stat(filePath)
    if (!stat.isFile()) {
      throw new Error('Repository manifest file must be a regular file.')
    }
    if (stat.size > MAX_REGISTRY_MANIFEST_BYTES) {
      throw new Error(
        `Repository manifest exceeds the maximum allowed size: ${stat.size} > ${MAX_REGISTRY_MANIFEST_BYTES}.`
      )
    }

    return parseManifestJson(
      await fse.readFile(filePath, 'utf8'),
      this.options.allowInsecureLocalUrls
    )
  }

  validateManifest(manifest: unknown): ExtensionRegistryManifest {
    const result = parseExtensionRegistryManifest(manifest, {
      allowInsecureLocalUrls: this.options.allowInsecureLocalUrls
    })
    if (result.manifest) {
      return result.manifest
    }

    const details = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
    throw new Error(`Repository manifest is invalid.${details ? ` ${details}` : ''}`)
  }
}

function parseManifestJson(
  text: string,
  allowInsecureLocalUrls: boolean | undefined
): ExtensionRegistryManifest {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error'
    throw new Error(`Repository manifest is not valid JSON: ${message}`)
  }

  const result = parseExtensionRegistryManifest(value, {
    allowInsecureLocalUrls
  })
  if (result.manifest) {
    return result.manifest
  }

  const details = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
  throw new Error(`Repository manifest is invalid.${details ? ` ${details}` : ''}`)
}

function createManifestDigest(manifest: ExtensionRegistryManifest): string {
  return createHash('sha256')
    .update(stringifyExtensionRegistryCanonicalJson(manifest))
    .digest('hex')
}

async function readResponseTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get('content-length')
  if (contentLength) {
    const declaredSize = Number(contentLength)
    if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
      throw new Error(
        `Repository manifest exceeds the maximum allowed size: ${declaredSize} > ${maxBytes}.`
      )
    }
  }

  if (!response.body) {
    return await response.text()
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    received += value.byteLength
    if (received > maxBytes) {
      throw new Error(
        `Repository manifest exceeds the maximum allowed size: ${received} > ${maxBytes}.`
      )
    }
    chunks.push(Buffer.from(value))
  }

  return Buffer.concat(chunks).toString('utf8')
}
