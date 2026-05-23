#!/usr/bin/env tsx

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

interface ToolingPackage {
  readonly name: string
  readonly dir: string
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
  tag?: string
}

interface RunOptions {
  cwd?: string
}

const repoRoot = findRepoRoot(process.cwd())

const toolingPackages: readonly ToolingPackage[] = [
  { name: '@kisaki/extension-api', dir: 'packages/extension-api' },
  { name: '@kisaki/extension-registry', dir: 'packages/extension-registry' },
  { name: '@kisaki/extension-sdk', dir: 'packages/extension-sdk' },
  { name: '@kisaki/extension-cli', dir: 'packages/extension-cli' },
  { name: 'create-kisaki-extension', dir: 'packages/create-kisaki-extension' }
]

const internalDependencies = new Map<string, readonly string[]>([
  ['@kisaki/extension-registry', ['@kisaki/extension-api']],
  ['@kisaki/extension-sdk', ['@kisaki/extension-api']],
  ['@kisaki/extension-cli', ['@kisaki/extension-api', '@kisaki/extension-registry']],
  ['create-kisaki-extension', ['@kisaki/extension-api']]
])

const templatePackagePath = 'packages/create-kisaki-extension/templates/default/package.json'
const extensionApiVersionPath = 'packages/extension-api/src/version.ts'
const templateDependencyNames = [
  '@kisaki/extension-api',
  '@kisaki/extension-sdk',
  '@kisaki/extension-cli'
] as const
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

const [command, ...args] = process.argv.slice(2)

try {
  switch (command) {
    case 'check':
      checkTooling(args[0])
      break
    case 'set-version':
      setToolingVersion(requireVersionArgument(args[0]))
      break
    case 'build':
      buildTooling()
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
} catch (error) {
  console.error(`[extension-tooling] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
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

  for (const toolingPackage of toolingPackages) {
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
  console.log(
    `[extension-tooling] Publishing ${version} with npm dist-tag "${tag}"${options.dryRun ? ' (dry run)' : ''}.`
  )

  for (const toolingPackage of toolingPackages) {
    console.log(`[extension-tooling] Publishing ${toolingPackage.name}...`)
    const publishArgs = ['publish', '--access', 'public', '--no-git-checks', '--tag', tag]

    if (options.dryRun) {
      publishArgs.push('--dry-run')
    }

    run('pnpm', publishArgs, { cwd: packageDir(toolingPackage.dir) })
  }
}

function buildTooling(): void {
  checkTooling()

  for (const toolingPackage of toolingPackages) {
    console.log(`[extension-tooling] Building ${toolingPackage.name}...`)
    run('pnpm', ['run', 'build'], { cwd: packageDir(toolingPackage.dir) })
  }
}

function listToolingPackages(): void {
  for (const toolingPackage of toolingPackages) {
    console.log(toolingPackage.name)
  }
}

function collectToolingProblems(expectedVersion: string): string[] {
  const problems: string[] = []

  for (const toolingPackage of toolingPackages) {
    const packageJson = readJson(packagePath(toolingPackage.dir))
    if (packageJson.name !== toolingPackage.name) {
      problems.push(`${toolingPackage.dir}/package.json name must be ${toolingPackage.name}.`)
    }

    if (packageJson.version !== expectedVersion) {
      problems.push(
        `${toolingPackage.name} version must be ${expectedVersion}, found ${String(packageJson.version)}.`
      )
    }

    const dependencyNames = internalDependencies.get(toolingPackage.name) ?? []
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

  const templatePackage = readJson(templatePackagePath)
  for (const dependencyName of templateDependencyNames) {
    const actual =
      templatePackage.dependencies?.[dependencyName] ??
      templatePackage.devDependencies?.[dependencyName]
    if (actual !== '^__TOOLING_VERSION__') {
      problems.push(
        `${templatePackagePath} must use "^__TOOLING_VERSION__" for ${dependencyName}, found ${String(
          actual
        )}.`
      )
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

  for (const toolingPackage of toolingPackages) {
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

    throw new Error(`Unknown publish option: ${arg}`)
  }

  return options
}

function getDefaultDistTag(version: string): string {
  return version.includes('-') ? 'next' : 'latest'
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

function readJson(relativePath: string): PackageJson {
  return JSON.parse(readText(relativePath)) as PackageJson
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
  if (process.platform === 'win32') {
    const commandLine = [commandName, ...runArgs].map(quoteWindowsShellArg).join(' ')
    const result = spawnSync(commandLine, {
      cwd: options.cwd ?? repoRoot,
      stdio: 'inherit',
      shell: true
    })

    if (result.error) {
      throw result.error
    }

    if (result.status !== 0) {
      throw new Error(`${commandLine} failed with exit code ${String(result.status)}.`)
    }

    return
  }

  const result = spawnSync(commandName, runArgs, {
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

function quoteWindowsShellArg(value: string): string {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) {
    return value
  }

  return `"${value.replace(/"/g, '\\"')}"`
}

function printUsage(receivedCommand: string | undefined): void {
  if (receivedCommand) {
    console.error(`[extension-tooling] Unknown command: ${receivedCommand}`)
  }

  console.log(`Usage:
  tsx scripts/extension-tooling.ts check [version]
  tsx scripts/extension-tooling.ts set-version <version>
  tsx scripts/extension-tooling.ts build
  tsx scripts/extension-tooling.ts publish [--dry-run] [--tag <tag>]
  tsx scripts/extension-tooling.ts list`)
}
