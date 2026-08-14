import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { chmod, copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import { path7za } from '7zip-bin'
import { getBundledBinaryPlatformDir, toBundledExecutableName } from '../../src/shared/binaries'
import type { MediaBinaryToolContext } from './paths'
import { MEDIA_BINARY_SOURCES, type MediaBinarySource } from './sources'
import { checkMediaBinaries, missingMediaBinariesError } from './stage'

/**
 * Downloads the pinned release archives for the current platform, verifies
 * their checksums, and stages the contained executables into the packaged
 * resource layout. Requires a pin list in `sources.ts`; platforms without one
 * must stage binaries manually.
 *
 * Proxied environments: run with `HTTPS_PROXY=<url>` plus `NODE_USE_ENV_PROXY=1`
 * so the built-in fetch routes through the proxy (Node >= 24).
 */
export async function fetchMediaBinaries(context: MediaBinaryToolContext): Promise<void> {
  const sources = pinnedSources(context)
  await stageFromSources(context, sources)
  console.log(`[media-binaries] Fetched ${sources.length} executable(s) into ${context.targetRoot}`)
}

/**
 * Makes sure the current platform has every bundled tool. Already-staged files
 * are left alone; missing files are fetched from the pin list. Platforms
 * without pins still have to be staged by hand.
 */
export async function ensureMediaBinaries(context: MediaBinaryToolContext): Promise<void> {
  const statuses = await checkMediaBinaries(context)
  if (statuses.every((status) => status.present)) {
    console.log(
      `[media-binaries] ${statuses.length} executable(s) ready for ${context.platform}-${context.arch}`
    )
    return
  }

  const missing = statuses.filter((status) => !status.present)
  console.log(
    `[media-binaries] Missing ${missing.map((status) => status.executable).join(', ')}; fetching pinned sources`
  )
  await fetchMediaBinaries(context)

  const remaining = (await checkMediaBinaries(context)).filter((status) => !status.present)
  if (remaining.length > 0) {
    throw missingMediaBinariesError(context, remaining)
  }
}

function pinnedSources(context: MediaBinaryToolContext): readonly MediaBinarySource[] {
  const platformKey = getBundledBinaryPlatformDir(context.platform, context.arch)
  const sources = MEDIA_BINARY_SOURCES[platformKey]

  if (!sources) {
    throw new Error(
      `No pinned sources for ${platformKey}. Stage the tools manually: media-binaries stage --from <dir>`
    )
  }

  return sources
}

async function stageFromSources(
  context: MediaBinaryToolContext,
  sources: readonly MediaBinarySource[]
): Promise<void> {
  await mkdir(context.targetRoot, { recursive: true })
  const workDir = await mkdtemp(path.join(tmpdir(), 'kisaki-media-binaries-'))

  try {
    for (const source of sources) {
      await fetchOne(context, source, workDir)
    }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

async function fetchOne(
  context: MediaBinaryToolContext,
  source: MediaBinarySource,
  workDir: string
): Promise<void> {
  const archivePath = path.join(workDir, path.basename(new URL(source.url).pathname))
  console.log(`[media-binaries] Downloading ${source.binary} from ${source.url}`)
  await download(source.url, archivePath)

  const digest = await sha256Of(archivePath)
  if (digest !== source.sha256.toLowerCase()) {
    throw new Error(
      `Checksum mismatch for ${path.basename(archivePath)}: expected ${source.sha256}, got ${digest}`
    )
  }

  const extractDir = path.join(workDir, `${source.binary}-extracted`)
  await extractArchiveEntry(archivePath, source.archiveEntry, extractDir)

  const extractedPath = path.join(extractDir, path.basename(source.archiveEntry))
  const targetPath = path.join(
    context.targetRoot,
    toBundledExecutableName(source.binary, context.platform)
  )
  await copyFile(extractedPath, targetPath)
  if (context.platform !== 'win32') {
    await chmod(targetPath, 0o755)
  }
}

async function download(url: string, targetPath: string): Promise<void> {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) {
    throw new Error(`Download failed with HTTP ${response.status}: ${url}`)
  }

  await pipeline(
    Readable.fromWeb(response.body as WebReadableStream),
    createWriteStream(targetPath)
  )
}

async function sha256Of(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

/** Extracts a single archive entry (flattened) into `outDir` using the bundled 7za. */
function extractArchiveEntry(archivePath: string, entry: string, outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(path7za, ['e', archivePath, `-o${outDir}`, entry, '-y'], {
      stdio: ['ignore', 'ignore', 'pipe']
    })

    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`7za exited with code ${code ?? 'unknown'}: ${stderr.trim()}`))
      }
    })
  })
}
