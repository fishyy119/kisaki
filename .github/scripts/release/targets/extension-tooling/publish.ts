import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { checkTooling, getToolingVersion } from '../../../../../tools/extension-tooling/contract'
import { run, runCapture } from '../../../../../tools/extension-tooling/process'
import {
  loadToolingWorkspace,
  type ToolingWorkspace
} from '../../../../../tools/extension-tooling/workspace'
import { collectToolingTarballs, resolveReleaseDirectory, type ToolingTarball } from './pack'

interface PublishOptions {
  provenance: boolean
  dir?: string
}

interface ReleaseContext {
  readonly version: string
  readonly tag: string
  readonly outDir: string
  readonly tarballs: readonly ToolingTarball[]
}

interface ToolingPublishState {
  readonly tarball: ToolingTarball
  readonly alreadyPublished: boolean
}

if (isMainModule()) {
  void main().catch((error: unknown) => {
    console.error(`[extension-tooling] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}

async function main(): Promise<void> {
  publishTooling(loadToolingWorkspace(process.cwd()), process.argv.slice(2))
}

export function publishTooling(workspace: ToolingWorkspace, args: readonly string[]): void {
  const options = parsePublishOptions(args)
  const context = loadReleaseContext(workspace, options)

  console.log(
    `[extension-tooling] Publishing ${context.version} from ${path.relative(
      workspace.root,
      context.outDir
    )} with npm dist-tag "${context.tag}".`
  )

  const publishStates = inspectPublishedTarballs(workspace, context.tarballs, context.version)
  const missingTarballs = getMissingTarballs(publishStates)
  let publishedCount = 0
  let skippedCount = 0

  if (missingTarballs.length > 0) {
    console.log(
      `[extension-tooling] Running npm publish dry-run for ${missingTarballs.length} package(s) before publishing.`
    )
    verifyPublishPackageContents(workspace, missingTarballs, context.tag)
  }

  for (const { tarball, alreadyPublished } of publishStates) {
    if (alreadyPublished) {
      console.log(
        `[extension-tooling] Skipping ${tarball.packageName}@${context.version}; npm already has the identical tarball.`
      )
      skippedCount += 1
      continue
    }

    console.log(`[extension-tooling] Publishing ${tarball.packageName}...`)
    const publishArgs = ['publish', tarball.filePath, '--access', 'public', '--tag', context.tag]
    if (options.provenance) {
      publishArgs.push('--provenance')
    }

    run('npm', publishArgs, workspace.root)
    publishedCount += 1
  }

  console.log(
    `[extension-tooling] npm release ${context.version} is published (${publishedCount} published, ${skippedCount} already published).`
  )
}

function loadReleaseContext(
  workspace: ToolingWorkspace,
  options: { readonly dir?: string }
): ReleaseContext {
  const version = getToolingVersion(workspace)
  checkTooling(workspace, version)

  const tag = derivePublishDistTag(version)
  const outDir = resolveReleaseDirectory(workspace, version, options.dir)
  const tarballs = collectToolingTarballs(workspace, version, outDir)

  return {
    version,
    tag,
    outDir,
    tarballs
  }
}

function verifyPublishPackageContents(
  workspace: ToolingWorkspace,
  tarballs: readonly ToolingTarball[],
  tag: string
): void {
  for (const tarball of tarballs) {
    console.log(`[extension-tooling] Checking ${tarball.packageName} package contents...`)
    run(
      'npm',
      ['publish', tarball.filePath, '--access', 'public', '--tag', tag, '--dry-run'],
      workspace.root
    )
  }
}

function inspectPublishedTarballs(
  workspace: ToolingWorkspace,
  tarballs: readonly ToolingTarball[],
  version: string
): ToolingPublishState[] {
  console.log('[extension-tooling] Checking npm package versions...')

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

function getMissingTarballs(publishStates: readonly ToolingPublishState[]): ToolingTarball[] {
  return publishStates.filter((state) => !state.alreadyPublished).map((state) => state.tarball)
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

function parsePublishOptions(args: readonly string[]): PublishOptions {
  const options: PublishOptions = { provenance: false }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--provenance') {
      options.provenance = true
      continue
    }

    if (arg === '--dir') {
      const value = args[index + 1]
      if (!value) {
        throw new Error(`${arg} requires a value.`)
      }

      options.dir = value
      index += 1
      continue
    }

    throw new Error(`Unknown publish option: ${arg}`)
  }

  return options
}

function derivePublishDistTag(version: string): string {
  const [, prerelease] = version.split('-', 2)
  if (!prerelease) {
    return 'latest'
  }

  const prereleaseStage = prerelease.split('.')[0]
  if (prereleaseStage === 'alpha' || prereleaseStage === 'beta' || prereleaseStage === 'rc') {
    return prereleaseStage
  }

  return 'experimental'
}

function sha512Integrity(filePath: string): string {
  const data = new Uint8Array(readFileSync(filePath))
  return `sha512-${createHash('sha512').update(data).digest('base64')}`
}

function isMainModule(): boolean {
  const entryPath = process.argv[1]
  return entryPath !== undefined && import.meta.url === pathToFileURL(path.resolve(entryPath)).href
}
