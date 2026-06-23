import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { checkTooling, getToolingVersion } from './contract'
import { collectToolingTarballs, resolveReleaseDirectory, type ToolingTarball } from './pack'
import { run, runCapture } from './process'
import type { ToolingWorkspace } from './workspace'

interface PublishOptions {
  dryRun: boolean
  provenance: boolean
  dir?: string
  tag?: string
}

interface ToolingPublishState {
  readonly tarball: ToolingTarball
  readonly alreadyPublished: boolean
}

export function publishTooling(workspace: ToolingWorkspace, args: readonly string[]): void {
  const options = parsePublishOptions(args)
  const version = getToolingVersion(workspace)
  checkTooling(workspace, version)

  const tag = options.tag ?? getDefaultDistTag(version)
  const additionalTags = options.tag === undefined ? getAdditionalDistTags(version, tag) : []
  const outDir = resolveReleaseDirectory(workspace, version, options.dir)
  const tarballs = collectToolingTarballs(workspace, version, outDir)
  const tagSummary = [tag, ...additionalTags].map((distTag) => `"${distTag}"`).join(', ')

  console.log(
    `[extension-tooling] Publishing ${version} from ${path.relative(workspace.root, outDir)} with npm dist-tag ${tagSummary}${options.dryRun ? ' (dry run)' : ''}.`
  )

  if (options.dryRun) {
    verifyPackageContents(workspace, tarballs, tag)
    return
  }

  publishTarballs(workspace, tarballs, {
    version,
    tag,
    additionalTags,
    provenance: options.provenance
  })
}

function publishTarballs(
  workspace: ToolingWorkspace,
  tarballs: readonly ToolingTarball[],
  options: {
    readonly version: string
    readonly tag: string
    readonly additionalTags: readonly string[]
    readonly provenance: boolean
  }
): void {
  const publishStates = preflightPublish(workspace, tarballs, options.version)
  let publishedCount = 0

  for (const { tarball, alreadyPublished } of publishStates) {
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

    run('npm', publishArgs, workspace.root)
    publishedCount += 1
  }

  syncPublishedDistTags(workspace, tarballs, {
    version: options.version,
    tags: [options.tag, ...options.additionalTags]
  })

  console.log(
    `[extension-tooling] npm release ${options.version} is complete (${publishedCount} published, ${publishStates.length - publishedCount} already present).`
  )
}

function syncPublishedDistTags(
  workspace: ToolingWorkspace,
  tarballs: readonly ToolingTarball[],
  options: { readonly version: string; readonly tags: readonly string[] }
): void {
  console.log(`[extension-tooling] Syncing npm dist-tags: ${options.tags.join(', ')}.`)

  for (const tarball of tarballs) {
    const currentTags = getPublishedDistTags(workspace, tarball.packageName)

    for (const tag of options.tags) {
      if (currentTags[tag] === options.version) {
        continue
      }

      console.log(
        `[extension-tooling] Setting ${tarball.packageName}@${tag} to ${options.version}.`
      )
      run(
        'npm',
        ['dist-tag', 'add', `${tarball.packageName}@${options.version}`, tag],
        workspace.root
      )
    }
  }
}

function verifyPackageContents(
  workspace: ToolingWorkspace,
  tarballs: readonly ToolingTarball[],
  tag: string
): void {
  for (const tarball of tarballs) {
    console.log(`[extension-tooling] Checking ${tarball.packageName} package contents...`)
    run(
      'npm',
      ['publish', tarball.filePath, '--access', 'public', '--tag', tag, '--dry-run', '--force'],
      workspace.root
    )
  }
}

function preflightPublish(
  workspace: ToolingWorkspace,
  tarballs: readonly ToolingTarball[],
  version: string
): ToolingPublishState[] {
  console.log('[extension-tooling] Preflighting npm package versions...')

  return tarballs.map((tarball) => {
    const localIntegrity = sha512Integrity(tarball.filePath)
    const publishedIntegrity = getPublishedIntegrity(workspace, tarball.packageName, version)

    if (publishedIntegrity !== undefined && publishedIntegrity !== localIntegrity) {
      throw new Error(
        `${tarball.packageName}@${version} already exists on npm with different contents. Choose a new tooling version.`
      )
    }

    return {
      tarball,
      alreadyPublished: publishedIntegrity === localIntegrity
    }
  })
}

function getPublishedIntegrity(
  workspace: ToolingWorkspace,
  packageName: string,
  version: string
): string | undefined {
  const packageSpec = `${packageName}@${version}`
  const result = runCapture(
    'npm',
    ['view', packageSpec, 'dist.integrity', '--json', '--prefer-online'],
    workspace.root
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

function getPublishedDistTags(
  workspace: ToolingWorkspace,
  packageName: string
): Record<string, string> {
  const result = runCapture(
    'npm',
    ['view', packageName, 'dist-tags', '--json', '--prefer-online'],
    workspace.root
  )

  if (result.status !== 0) {
    throw new Error(
      `Failed to query npm dist-tags for ${packageName} (exit code ${String(result.status ?? 'unknown')}).`
    )
  }

  let distTags: unknown
  try {
    distTags = JSON.parse(result.stdout.trim())
  } catch {
    throw new Error(`npm returned invalid dist-tag metadata for ${packageName}.`)
  }

  if (distTags === null || typeof distTags !== 'object' || Array.isArray(distTags)) {
    throw new Error(`npm returned invalid dist-tag metadata for ${packageName}.`)
  }

  return Object.fromEntries(
    Object.entries(distTags).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )
}

function parsePublishOptions(args: readonly string[]): PublishOptions {
  const options: PublishOptions = { dryRun: false, provenance: false }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--provenance') {
      options.provenance = true
      continue
    }

    if (arg === '--tag' || arg === '--dir') {
      const value = args[index + 1]
      if (!value) {
        throw new Error(`${arg} requires a value.`)
      }

      if (arg === '--tag') {
        options.tag = value
      } else {
        options.dir = value
      }
      index += 1
      continue
    }

    throw new Error(`Unknown publish option: ${arg}`)
  }

  return options
}

function getDefaultDistTag(version: string): string {
  const [core, prerelease] = version.split('-', 2)
  if (core.startsWith('0.')) {
    return 'experimental'
  }

  if (!prerelease) {
    return 'latest'
  }

  const prereleaseStage = prerelease.split('.')[0]
  if (prereleaseStage === 'alpha' || prereleaseStage === 'beta' || prereleaseStage === 'rc') {
    return prereleaseStage
  }

  return 'experimental'
}

function getAdditionalDistTags(version: string, primaryTag: string): string[] {
  const [core, prerelease] = version.split('-', 2)

  // npmjs.org does not allow removing "latest". During 0.x, keep it as a default-install
  // alias for the newest plain experimental release so it never points at stale tooling.
  if (core.startsWith('0.') && !prerelease && primaryTag !== 'latest') {
    return ['latest']
  }

  return []
}

function sha512Integrity(filePath: string): string {
  const data = new Uint8Array(readFileSync(filePath))
  return `sha512-${createHash('sha512').update(data).digest('base64')}`
}
