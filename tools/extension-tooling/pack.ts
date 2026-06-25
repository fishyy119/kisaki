import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { checkTooling, getToolingVersion } from './contract'
import { run } from './process'
import { getPackageDirectory, type ToolingWorkspace } from './workspace'

export interface ToolingTarball {
  readonly packageName: string
  readonly fileName: string
  readonly filePath: string
}

interface PackOptions {
  outDir?: string
}

export function packTooling(workspace: ToolingWorkspace, args: readonly string[]): void {
  const options = parsePackOptions(args)
  const version = getToolingVersion(workspace)
  checkTooling(workspace, version)

  const outDir = resolveReleaseDirectory(workspace, version, options.outDir)
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  console.log(
    `[extension-tooling] Packing ${version} into ${path.relative(workspace.root, outDir)}.`
  )

  for (const toolingPackage of workspace.manifest.packages) {
    console.log(`[extension-tooling] Packing ${toolingPackage.name}...`)
    run(
      'pnpm',
      ['pack', '--pack-destination', outDir],
      getPackageDirectory(workspace, toolingPackage)
    )
  }

  const tarballs = collectToolingTarballs(workspace, version, outDir)
  writeChecksums(outDir, tarballs)
  writePackageList(workspace, outDir, version)
  console.log(`[extension-tooling] Packed ${tarballs.length} package tarballs.`)
}

export function resolveReleaseDirectory(
  workspace: ToolingWorkspace,
  version: string,
  customDir?: string
): string {
  const outputDir = customDir ?? path.join('.tmp', 'release', 'extension-tooling', `v${version}`)
  const fullPath = path.resolve(workspace.root, outputDir)
  const relativePath = path.relative(workspace.root, fullPath)

  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Release output directory must stay inside the repository: ${outputDir}`)
  }

  return fullPath
}

export function collectToolingTarballs(
  workspace: ToolingWorkspace,
  version: string,
  outDir: string
): ToolingTarball[] {
  return workspace.manifest.packages.map((toolingPackage) => {
    const fileName = getTarballFileName(toolingPackage.name, version)
    const filePath = path.join(outDir, fileName)

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new Error(`Missing package tarball: ${path.relative(workspace.root, filePath)}`)
    }

    return {
      packageName: toolingPackage.name,
      fileName,
      filePath
    }
  })
}

function parsePackOptions(args: readonly string[]): PackOptions {
  const options: PackOptions = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg !== '--out-dir') {
      throw new Error(`Unknown pack option: ${arg}`)
    }

    const outDir = args[index + 1]
    if (!outDir) {
      throw new Error('--out-dir requires a value.')
    }
    options.outDir = outDir
    index += 1
  }

  return options
}

function getTarballFileName(packageName: string, version: string): string {
  return `${packageName.replace(/^@/, '').replace(/\//g, '-')}-${version}.tgz`
}

function writeChecksums(outDir: string, tarballs: readonly ToolingTarball[]): void {
  const checksumLines = tarballs
    .map((tarball) => `${sha256File(tarball.filePath)}  ${tarball.fileName}`)
    .join('\n')

  writeFileSync(path.join(outDir, 'SHA256SUMS'), `${checksumLines}\n`, 'utf-8')
}

function writePackageList(workspace: ToolingWorkspace, outDir: string, version: string): void {
  const packageLines = workspace.manifest.packages
    .map((toolingPackage) => {
      const packageUrl = `https://www.npmjs.com/package/${toolingPackage.name}/v/${version}`
      return `- [${toolingPackage.name}@${version}](${packageUrl})`
    })
    .join('\n')

  writeFileSync(
    path.join(outDir, 'PACKAGES.md'),
    `## Published Packages\n\n${packageLines}\n`,
    'utf-8'
  )
}

function sha256File(filePath: string): string {
  const data = new Uint8Array(readFileSync(filePath))
  return createHash('sha256').update(data).digest('hex')
}
