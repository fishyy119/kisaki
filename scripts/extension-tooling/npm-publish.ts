import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { run, runCapture } from './process'

export interface ToolingTarball {
  readonly packageName: string
  readonly fileName: string
  readonly filePath: string
}

interface NpmPublishOptions {
  readonly version: string
  readonly tag: string
  readonly dryRun: boolean
  readonly provenance: boolean
}

interface ToolingPublishState {
  readonly tarball: ToolingTarball
  readonly localIntegrity: string
  readonly alreadyPublished: boolean
}

const registryVerificationAttempts = 6
const registryVerificationDelayMs = 2_000

export async function publishToolingTarballs(
  repoRoot: string,
  tarballs: readonly ToolingTarball[],
  options: NpmPublishOptions
): Promise<void> {
  if (options.dryRun) {
    for (const tarball of tarballs) {
      console.log(`[extension-tooling] Checking ${tarball.packageName} package contents...`)
      run(
        'npm',
        [
          'publish',
          tarball.filePath,
          '--access',
          'public',
          '--tag',
          options.tag,
          '--dry-run',
          '--force'
        ],
        repoRoot
      )
    }
    return
  }

  const publishStates = preflightToolingPublish(repoRoot, tarballs, options.version)
  let publishedCount = 0

  for (const state of publishStates) {
    const { tarball, localIntegrity, alreadyPublished } = state
    if (alreadyPublished) {
      console.log(
        `[extension-tooling] Skipping ${tarball.packageName}@${options.version}; npm already has the identical tarball.`
      )
      continue
    }

    console.log(`[extension-tooling] Publishing ${tarball.packageName}...`)
    const publishArgs = ['publish', tarball.filePath, '--access', 'public', '--tag', options.tag]
    if (options.provenance) {
      publishArgs.push('--provenance')
    }

    try {
      run('npm', publishArgs, repoRoot)
    } catch (error) {
      try {
        await waitForPublishedTarball(repoRoot, tarball, options.version, localIntegrity)
      } catch {
        throw error
      }

      console.log(
        `[extension-tooling] ${tarball.packageName}@${options.version} reached npm despite the publish command failure; continuing.`
      )
      publishedCount += 1
      continue
    }

    await waitForPublishedTarball(repoRoot, tarball, options.version, localIntegrity)
    publishedCount += 1
  }

  console.log(
    `[extension-tooling] npm release ${options.version} is complete (${publishedCount} published, ${publishStates.length - publishedCount} already present).`
  )
}

function preflightToolingPublish(
  repoRoot: string,
  tarballs: readonly ToolingTarball[],
  version: string
): ToolingPublishState[] {
  console.log('[extension-tooling] Preflighting npm package versions...')

  return tarballs.map((tarball) => {
    const localIntegrity = sha512Integrity(tarball.filePath)
    const publishedIntegrity = getPublishedIntegrity(repoRoot, tarball.packageName, version)

    if (publishedIntegrity !== undefined && publishedIntegrity !== localIntegrity) {
      throw new Error(
        `${tarball.packageName}@${version} already exists on npm with different contents. Choose a new tooling version.`
      )
    }

    return {
      tarball,
      localIntegrity,
      alreadyPublished: publishedIntegrity === localIntegrity
    }
  })
}

async function waitForPublishedTarball(
  repoRoot: string,
  tarball: ToolingTarball,
  version: string,
  localIntegrity: string
): Promise<void> {
  for (let attempt = 1; attempt <= registryVerificationAttempts; attempt += 1) {
    const publishedIntegrity = getPublishedIntegrity(repoRoot, tarball.packageName, version)
    if (publishedIntegrity === localIntegrity) {
      console.log(`[extension-tooling] Verified ${tarball.packageName}@${version} on npm.`)
      return
    }

    if (publishedIntegrity !== undefined) {
      throw new Error(`${tarball.packageName}@${version} was published with unexpected contents.`)
    }

    if (attempt < registryVerificationAttempts) {
      await delay(registryVerificationDelayMs)
    }
  }

  throw new Error(
    `${tarball.packageName}@${version} was not visible on npm after ${registryVerificationAttempts} checks.`
  )
}

function getPublishedIntegrity(
  repoRoot: string,
  packageName: string,
  version: string
): string | undefined {
  const packageSpec = `${packageName}@${version}`
  const result = runCapture(
    'npm',
    ['view', packageSpec, 'dist.integrity', '--json', '--prefer-online'],
    repoRoot
  )

  if (result.status === 0) {
    const output = result.stdout.trim()
    let integrity: unknown
    try {
      integrity = JSON.parse(output)
    } catch {
      throw new Error(`npm returned invalid integrity metadata for ${packageSpec}.`)
    }

    if (typeof integrity !== 'string' || !integrity.startsWith('sha512-')) {
      throw new Error(`npm returned missing integrity metadata for ${packageSpec}.`)
    }
    return integrity
  }

  const errorOutput = `${result.stdout}\n${result.stderr}`
  if (/\bE404\b|404 Not Found/i.test(errorOutput)) {
    return undefined
  }

  throw new Error(
    `Failed to query npm for ${packageSpec} (exit code ${String(result.status ?? 'unknown')}).`
  )
}

function sha512Integrity(filePath: string): string {
  const data = new Uint8Array(readFileSync(filePath))
  return `sha512-${createHash('sha512').update(data).digest('base64')}`
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
