#!/usr/bin/env tsx

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import spawn from 'cross-spawn'

interface ExtensionToolingPackage {
  readonly name: string
  readonly dir: string
}

interface ExtensionToolingManifest {
  readonly packages: readonly ExtensionToolingPackage[]
  readonly internalDependencies: Record<string, readonly string[]>
  readonly buildPackageGroups: readonly (readonly string[])[]
  readonly outputPaths: readonly string[]
}

interface PackageJson {
  name?: unknown
  version?: unknown
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

interface PublishOptions {
  dryRun: boolean
  dir?: string
  tag?: string
}

interface PackOptions {
  outDir?: string
}

interface RunOptions {
  cwd?: string
}

const repoRoot = findRepoRoot(process.cwd())
const toolingManifest = readJson<ExtensionToolingManifest>(
  'packages/extension-tooling-manifest.json'
)
const extensionToolingPackages = toolingManifest.packages
const extensionToolingInternalDependencies = toolingManifest.internalDependencies
const extensionToolingBuildPackageGroups = toolingManifest.buildPackageGroups
const extensionToolingOutputPaths = toolingManifest.outputPaths

const extensionApiVersionPath = 'packages/extension-api/src/version.ts'
const templateDependencyContracts = [
  {
    path: 'packages/create-kisaki-extension/templates/extension/base/package.json',
    dependencyNames: ['@kisaki3/extension-api', '@kisaki3/extension-sdk', '@kisaki3/extension-cli']
  },
  {
    path: 'packages/create-kisaki-extension/templates/extension/ui/vue-kit/package.patch.json',
    dependencyNames: ['@kisaki3/extension-ui-vue']
  }
] as const
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

const [command, ...args] = process.argv.slice(2)

void main().catch((error: unknown) => {
  console.error(`[extension-tooling] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})

async function main(): Promise<void> {
  switch (command) {
    case 'check':
      checkTooling(args[0])
      break
    case 'set-version':
      setToolingVersion(requireVersionArgument(args[0]))
      break
    case 'build':
      await buildTooling()
      break
    case 'verify-output':
      verifyToolingOutput()
      break
    case 'pack':
      packTooling(args)
      break
    case 'publish':
      publishTooling(args)
      break
    case 'list':
      listToolingPackages()
      break
    default:
      printUsage(command)
      process.exit(command ? 1 : 0)
  }
}

function checkTooling(expectedVersion?: string): void {
  const version = getToolingVersion()
  if (expectedVersion !== undefined && version !== expectedVersion) {
    throw new Error(`Expected extension tooling ${expectedVersion}, found ${version}.`)
  }

  const problems = collectToolingProblems(version)
  if (problems.length > 0) {
    throw new Error(
      `Version contract failed:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`
    )
  }

  console.log(`[extension-tooling] ${version} contract is consistent.`)
}

function setToolingVersion(version: string): void {
  assertSemver(version)

  for (const toolingPackage of extensionToolingPackages) {
    const packageJsonPath = packagePath(toolingPackage.dir)
    const packageJson = readJson(packageJsonPath)
    packageJson.version = version
    writeJson(packageJsonPath, packageJson)
  }

  updateExtensionApiVersion(version)
  checkTooling(version)
}

function publishTooling(args: readonly string[]): void {
  const options = parsePublishOptions(args)
  const version = getToolingVersion()
  checkTooling(version)

  const tag = options.tag ?? getDefaultDistTag(version)
  const outDir = resolveReleaseOutputDir(version, options.dir)
  const tarballs = collectToolingTarballs(version, outDir)

  console.log(
    `[extension-tooling] Publishing ${version} from ${path.relative(repoRoot, outDir)} with npm dist-tag "${tag}"${options.dryRun ? ' (dry run)' : ''}.`
  )

  for (const tarball of tarballs) {
    console.log(`[extension-tooling] Publishing ${tarball.packageName}...`)
    const publishArgs = ['publish', tarball.filePath, '--access', 'public', '--tag', tag]

    if (options.dryRun) {
      publishArgs.push('--dry-run')
    }

    run('npm', publishArgs)
  }
}

async function buildTooling(): Promise<void> {
  checkTooling()

  for (const packageGroup of extensionToolingBuildPackageGroups) {
    await Promise.all(
      packageGroup.map((packageName) => {
        const toolingPackage = requireToolingPackage(packageName)
        console.log(`[extension-tooling] Building ${toolingPackage.name}...`)
        return runAsync('pnpm', ['run', 'build'], { cwd: packageDir(toolingPackage.dir) })
      })
    )
  }
}

function verifyToolingOutput(): void {
  const missingPaths = extensionToolingOutputPaths.filter(
    (outputPath) => !existsSync(resolveRepo(outputPath))
  )
  if (missingPaths.length > 0) {
    throw new Error(
      `Missing extension tooling output files:\n${missingPaths
        .map((outputPath) => `  - ${outputPath}`)
        .join('\n')}`
    )
  }

  console.log(`[extension-tooling] Verified ${extensionToolingOutputPaths.length} output files.`)
}

function packTooling(args: readonly string[]): void {
  const options = parsePackOptions(args)
  const version = getToolingVersion()
  checkTooling(version)

  const outDir = resolveReleaseOutputDir(version, options.outDir)
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  console.log(`[extension-tooling] Packing ${version} into ${path.relative(repoRoot, outDir)}.`)

  for (const toolingPackage of extensionToolingPackages) {
    console.log(`[extension-tooling] Packing ${toolingPackage.name}...`)
    run('pnpm', ['pack', '--pack-destination', outDir], {
      cwd: packageDir(toolingPackage.dir)
    })
  }

  const tarballs = collectToolingTarballs(version, outDir)
  writeChecksums(outDir, tarballs)
  writePackageList(outDir, version)
  console.log(`[extension-tooling] Packed ${tarballs.length} package tarballs.`)
}

function listToolingPackages(): void {
  for (const toolingPackage of extensionToolingPackages) {
    console.log(toolingPackage.name)
  }
}

function requireToolingPackage(packageName: string): ExtensionToolingPackage {
  const toolingPackage = extensionToolingPackages.find(
    (candidate) => candidate.name === packageName
  )
  if (!toolingPackage) {
    throw new Error(`Unknown extension tooling package: ${packageName}`)
  }

  return toolingPackage
}

function collectToolingProblems(expectedVersion: string): string[] {
  const problems: string[] = []

  for (const toolingPackage of extensionToolingPackages) {
    const packageJson = readJson(packagePath(toolingPackage.dir))
    if (packageJson.name !== toolingPackage.name) {
      problems.push(`${toolingPackage.dir}/package.json name must be ${toolingPackage.name}.`)
    }

    if (packageJson.version !== expectedVersion) {
      problems.push(
        `${toolingPackage.name} version must be ${expectedVersion}, found ${String(packageJson.version)}.`
      )
    }

    const dependencyNames = extensionToolingInternalDependencies[toolingPackage.name] ?? []
    for (const dependencyName of dependencyNames) {
      const dependencyVersion = packageJson.dependencies?.[dependencyName]
      if (dependencyVersion !== 'workspace:*') {
        problems.push(
          `${toolingPackage.name} must depend on ${dependencyName} with "workspace:*", found ${String(
            dependencyVersion
          )}.`
        )
      }
    }
  }

  for (const contract of templateDependencyContracts) {
    const templatePackage = readJson(contract.path)
    for (const dependencyName of contract.dependencyNames) {
      const actual =
        templatePackage.dependencies?.[dependencyName] ??
        templatePackage.devDependencies?.[dependencyName]
      if (actual !== '^__TOOLING_VERSION__') {
        problems.push(
          `${contract.path} must use "^__TOOLING_VERSION__" for ${dependencyName}, found ${String(
            actual
          )}.`
        )
      }
    }
  }

  const apiVersionSource = readText(extensionApiVersionPath)
  const expectedApiVersionSource = `export const EXTENSION_API_VERSION = '${expectedVersion}'\n`
  if (apiVersionSource !== expectedApiVersionSource) {
    problems.push(
      `${extensionApiVersionPath} must export EXTENSION_API_VERSION ${expectedVersion}.`
    )
  }

  return problems
}

function getToolingVersion(): string {
  const versions = new Map<string, unknown>()

  for (const toolingPackage of extensionToolingPackages) {
    const packageJson = readJson(packagePath(toolingPackage.dir))
    versions.set(toolingPackage.name, packageJson.version)
  }

  const uniqueVersions = [...new Set(versions.values())]
  if (uniqueVersions.length !== 1) {
    const lines = [...versions].map(([name, version]) => `${name}@${String(version)}`).join(', ')
    throw new Error(`Extension tooling packages must share one version: ${lines}.`)
  }

  const [version] = uniqueVersions
  assertSemver(version)
  return version
}

function updateExtensionApiVersion(version: string): void {
  writeFileSync(
    resolveRepo(extensionApiVersionPath),
    `export const EXTENSION_API_VERSION = '${version}'\n`,
    'utf-8'
  )
}

function parsePublishOptions(args: readonly string[]): PublishOptions {
  const options: PublishOptions = { dryRun: false }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--tag') {
      const tag = args[index + 1]
      if (!tag) {
        throw new Error('--tag requires a value.')
      }
      options.tag = tag
      index += 1
      continue
    }

    if (arg === '--dir') {
      const dir = args[index + 1]
      if (!dir) {
        throw new Error('--dir requires a value.')
      }
      options.dir = dir
      index += 1
      continue
    }

    throw new Error(`Unknown publish option: ${arg}`)
  }

  return options
}

function parsePackOptions(args: readonly string[]): PackOptions {
  const options: PackOptions = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--out-dir') {
      const outDir = args[index + 1]
      if (!outDir) {
        throw new Error('--out-dir requires a value.')
      }
      options.outDir = outDir
      index += 1
      continue
    }

    throw new Error(`Unknown pack option: ${arg}`)
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

function requireVersionArgument(version: string | undefined): string {
  if (!version) {
    throw new Error('set-version requires a semver version argument.')
  }

  return version.replace(/^v/, '')
}

function assertSemver(version: unknown): asserts version is string {
  if (typeof version !== 'string' || !semverPattern.test(version)) {
    throw new Error(`Invalid semver version: ${String(version)}.`)
  }
}

function packagePath(packageRelativeDir: string): string {
  return path.join(packageRelativeDir, 'package.json')
}

function packageDir(packageRelativeDir: string): string {
  return resolveRepo(packageRelativeDir)
}

function resolveReleaseOutputDir(version: string, customDir?: string): string {
  const outputDir = customDir ?? path.join('.release', 'extension-tooling', `v${version}`)
  const fullPath = path.resolve(repoRoot, outputDir)
  const relativePath = path.relative(repoRoot, fullPath)

  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Release output directory must stay inside the repository: ${outputDir}`)
  }

  return fullPath
}

interface ToolingTarball {
  readonly packageName: string
  readonly fileName: string
  readonly filePath: string
}

function collectToolingTarballs(version: string, outDir: string): ToolingTarball[] {
  return extensionToolingPackages.map((toolingPackage) => {
    const fileName = getTarballFileName(toolingPackage.name, version)
    const filePath = path.join(outDir, fileName)

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new Error(`Missing package tarball: ${path.relative(repoRoot, filePath)}`)
    }

    return {
      packageName: toolingPackage.name,
      fileName,
      filePath
    }
  })
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

function writePackageList(outDir: string, version: string): void {
  const packageLines = extensionToolingPackages
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

function readJson<T = PackageJson>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T
}

function writeJson(relativePath: string, value: PackageJson): void {
  writeFileSync(resolveRepo(relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

function readText(relativePath: string): string {
  const fullPath = resolveRepo(relativePath)
  if (!existsSync(fullPath)) {
    throw new Error(`Missing file: ${relativePath}`)
  }
  return readFileSync(fullPath, 'utf-8')
}

function resolveRepo(relativePath: string): string {
  return path.resolve(repoRoot, relativePath)
}

function findRepoRoot(startDir: string): string {
  let currentDir = path.resolve(startDir)

  while (true) {
    if (
      existsSync(path.join(currentDir, 'pnpm-workspace.yaml')) &&
      existsSync(path.join(currentDir, 'package.json'))
    ) {
      return currentDir
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      throw new Error('Could not find Kisaki repository root.')
    }

    currentDir = parentDir
  }
}

function run(commandName: string, runArgs: readonly string[], options: RunOptions = {}): void {
  const result = spawn.sync(commandName, runArgs, {
    cwd: options.cwd ?? repoRoot,
    stdio: 'inherit'
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(
      `${commandName} ${runArgs.join(' ')} failed with exit code ${String(result.status)}.`
    )
  }
}

function runAsync(
  commandName: string,
  runArgs: readonly string[],
  options: RunOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, runArgs, {
      cwd: options.cwd ?? repoRoot,
      stdio: 'inherit'
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          `${commandName} ${runArgs.join(' ')} failed with exit code ${String(code ?? 'unknown')}.`
        )
      )
    })
  })
}

function printUsage(receivedCommand: string | undefined): void {
  if (receivedCommand) {
    console.error(`[extension-tooling] Unknown command: ${receivedCommand}`)
  }

  console.log(`Usage:
  tsx scripts/extension-tooling.ts check [version]
  tsx scripts/extension-tooling.ts set-version <version>
  tsx scripts/extension-tooling.ts build
  tsx scripts/extension-tooling.ts verify-output
  tsx scripts/extension-tooling.ts pack [--out-dir <dir>]
  tsx scripts/extension-tooling.ts publish [--dir <dir>] [--dry-run] [--tag <tag>]
  tsx scripts/extension-tooling.ts list`)
}
