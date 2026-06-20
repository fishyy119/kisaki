import {
  getPackageJsonPath,
  readWorkspaceJson,
  readWorkspaceText,
  writeWorkspaceJson,
  writeWorkspaceText,
  type ToolingWorkspace
} from './workspace'

interface PackageJson {
  name?: unknown
  version?: unknown
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

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

export function checkTooling(workspace: ToolingWorkspace, expectedVersion?: string): void {
  const version = getToolingVersion(workspace)
  if (expectedVersion !== undefined && version !== expectedVersion) {
    throw new Error(`Expected extension tooling ${expectedVersion}, found ${version}.`)
  }

  const problems = collectToolingProblems(workspace, version)
  if (problems.length > 0) {
    throw new Error(
      `Version contract failed:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`
    )
  }

  console.log(`[extension-tooling] ${version} contract is consistent.`)
}

export function setToolingVersion(workspace: ToolingWorkspace, version: string): void {
  assertSemver(version)

  for (const toolingPackage of workspace.manifest.packages) {
    const packageJsonPath = getPackageJsonPath(toolingPackage)
    const packageJson = readWorkspaceJson<PackageJson>(workspace, packageJsonPath)
    packageJson.version = version
    writeWorkspaceJson(workspace, packageJsonPath, packageJson)
  }

  writeWorkspaceText(
    workspace,
    extensionApiVersionPath,
    `export const EXTENSION_API_VERSION = '${version}'\n`
  )
  checkTooling(workspace, version)
}

export function getToolingVersion(workspace: ToolingWorkspace): string {
  const versions = new Map<string, unknown>()

  for (const toolingPackage of workspace.manifest.packages) {
    const packageJson = readWorkspaceJson<PackageJson>(
      workspace,
      getPackageJsonPath(toolingPackage)
    )
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

export function parseToolingVersionArgument(value: string): string {
  const version = value.replace(/^v/, '')
  assertSemver(version)
  return version
}

function collectToolingProblems(workspace: ToolingWorkspace, expectedVersion: string): string[] {
  const { packages, internalDependencies } = workspace.manifest
  const problems = collectManifestProblems(workspace)
  const toolingPackageNames = new Set(packages.map(({ name }) => name))

  for (const toolingPackage of packages) {
    const packageJson = readWorkspaceJson<PackageJson>(
      workspace,
      getPackageJsonPath(toolingPackage)
    )
    if (packageJson.name !== toolingPackage.name) {
      problems.push(`${toolingPackage.dir}/package.json name must be ${toolingPackage.name}.`)
    }

    if (packageJson.version !== expectedVersion) {
      problems.push(
        `${toolingPackage.name} version must be ${expectedVersion}, found ${String(packageJson.version)}.`
      )
    }

    const declaredInternalDependencies = Object.keys(packageJson.dependencies ?? {}).filter(
      (dependencyName) => toolingPackageNames.has(dependencyName)
    )
    const manifestInternalDependencies = internalDependencies[toolingPackage.name] ?? []

    for (const dependencyName of manifestInternalDependencies) {
      const dependencyVersion = packageJson.dependencies?.[dependencyName]
      if (dependencyVersion !== 'workspace:*') {
        problems.push(
          `${toolingPackage.name} must depend on ${dependencyName} with "workspace:*", found ${String(
            dependencyVersion
          )}.`
        )
      }
    }

    for (const dependencyName of declaredInternalDependencies) {
      if (!manifestInternalDependencies.includes(dependencyName)) {
        problems.push(
          `${toolingPackage.name} dependency ${dependencyName} is missing from extension-tooling-manifest.json.`
        )
      }
    }
  }

  for (const contract of templateDependencyContracts) {
    const templatePackage = readWorkspaceJson<PackageJson>(workspace, contract.path)
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

  const apiVersionSource = readWorkspaceText(workspace, extensionApiVersionPath)
  const expectedApiVersionSource = `export const EXTENSION_API_VERSION = '${expectedVersion}'\n`
  if (apiVersionSource !== expectedApiVersionSource) {
    problems.push(
      `${extensionApiVersionPath} must export EXTENSION_API_VERSION ${expectedVersion}.`
    )
  }

  return problems
}

function collectManifestProblems(workspace: ToolingWorkspace): string[] {
  const { packages, internalDependencies, buildPackageGroups, outputPaths } = workspace.manifest
  const problems: string[] = []
  const packageIndexes = new Map<string, number>()
  const packageDirs = new Set<string>()

  for (const [index, toolingPackage] of packages.entries()) {
    if (packageIndexes.has(toolingPackage.name)) {
      problems.push(`Duplicate tooling package name: ${toolingPackage.name}.`)
    } else {
      packageIndexes.set(toolingPackage.name, index)
    }

    if (packageDirs.has(toolingPackage.dir)) {
      problems.push(`Duplicate tooling package directory: ${toolingPackage.dir}.`)
    } else {
      packageDirs.add(toolingPackage.dir)
    }
  }

  for (const [packageName, dependencyNames] of Object.entries(internalDependencies)) {
    const packageIndex = packageIndexes.get(packageName)
    if (packageIndex === undefined) {
      problems.push(`Internal dependency metadata references unknown package ${packageName}.`)
      continue
    }

    const seenDependencies = new Set<string>()
    for (const dependencyName of dependencyNames) {
      if (seenDependencies.has(dependencyName)) {
        problems.push(`${packageName} lists duplicate internal dependency ${dependencyName}.`)
        continue
      }
      seenDependencies.add(dependencyName)

      const dependencyIndex = packageIndexes.get(dependencyName)
      if (dependencyIndex === undefined) {
        problems.push(`${packageName} references unknown internal dependency ${dependencyName}.`)
      } else if (dependencyIndex >= packageIndex) {
        problems.push(
          `${dependencyName} must appear before dependent package ${packageName} in publish order.`
        )
      }
    }
  }

  const buildGroupIndexes = new Map<string, number>()
  for (const [groupIndex, packageGroup] of buildPackageGroups.entries()) {
    for (const packageName of packageGroup) {
      if (!packageIndexes.has(packageName)) {
        problems.push(`Build group ${groupIndex + 1} references unknown package ${packageName}.`)
      } else if (buildGroupIndexes.has(packageName)) {
        problems.push(`${packageName} appears in more than one build group.`)
      } else {
        buildGroupIndexes.set(packageName, groupIndex)
      }
    }
  }

  for (const packageName of packageIndexes.keys()) {
    if (!buildGroupIndexes.has(packageName)) {
      problems.push(`${packageName} is missing from buildPackageGroups.`)
    }
  }

  for (const [packageName, dependencyNames] of Object.entries(internalDependencies)) {
    const packageGroupIndex = buildGroupIndexes.get(packageName)
    if (packageGroupIndex === undefined) {
      continue
    }

    for (const dependencyName of dependencyNames) {
      const dependencyGroupIndex = buildGroupIndexes.get(dependencyName)
      if (dependencyGroupIndex !== undefined && dependencyGroupIndex >= packageGroupIndex) {
        problems.push(`${dependencyName} must build before dependent package ${packageName}.`)
      }
    }
  }

  const seenOutputPaths = new Set<string>()
  const packagesWithOutput = new Set<string>()
  for (const outputPath of outputPaths) {
    if (seenOutputPaths.has(outputPath)) {
      problems.push(`Duplicate tooling output path: ${outputPath}.`)
      continue
    }
    seenOutputPaths.add(outputPath)

    const owner = packages.find(({ dir }) => outputPath.startsWith(`${dir}/`))
    if (!owner) {
      problems.push(`Tooling output path is outside a tooling package: ${outputPath}.`)
    } else {
      packagesWithOutput.add(owner.name)
    }
  }

  for (const packageName of packageIndexes.keys()) {
    if (!packagesWithOutput.has(packageName)) {
      problems.push(`${packageName} has no required output path.`)
    }
  }

  return problems
}

function assertSemver(version: unknown): asserts version is string {
  if (typeof version !== 'string' || !semverPattern.test(version)) {
    throw new Error(`Invalid semver version: ${String(version)}.`)
  }
}
