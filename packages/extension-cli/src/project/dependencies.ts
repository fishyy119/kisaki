import { CliError } from '../errors'
import type { ExtensionProject } from './model'
import { readJsonFile } from './model'

/** Packages compiled into every extension host bundle. */
export const BUNDLED_EXTENSION_PACKAGES: ReadonlySet<string> = new Set([
  '@kisaki3/extension-api',
  '@kisaki3/extension-sdk'
])

interface ProjectPackageJson {
  dependencies?: Record<string, unknown>
  optionalDependencies?: Record<string, unknown>
}

/** One external host dependency that must ship beside the extension bundle. */
export interface ExtensionRuntimeDependency {
  name: string
  optional: boolean
  spec: string
}

/** Reads validated host runtime dependencies from the extension package. */
export async function readExtensionRuntimeDependencies(
  project: ExtensionProject
): Promise<readonly ExtensionRuntimeDependency[]> {
  const packageJson = await readProjectPackageJson(project)
  const dependencies = new Map<string, ExtensionRuntimeDependency>()
  addRuntimeDependencies(dependencies, packageJson.dependencies, false)
  addRuntimeDependencies(dependencies, packageJson.optionalDependencies, true)

  const runtimeDependencies = [...dependencies.values()].toSorted((left, right) =>
    left.name.localeCompare(right.name, 'en')
  )
  const bundled = runtimeDependencies.find((dependency) =>
    BUNDLED_EXTENSION_PACKAGES.has(dependency.name)
  )
  if (bundled) {
    throw new CliError(
      `${bundled.name} is bundled into the host output and must be declared in devDependencies.`
    )
  }

  const workspaceDependency = runtimeDependencies.find((dependency) =>
    dependency.spec.startsWith('workspace:')
  )
  if (workspaceDependency) {
    throw new CliError(
      `Runtime workspace dependency "${workspaceDependency.name}" cannot be packaged. Publish it with a concrete version, or bundle it into the host output and move it to devDependencies.`
    )
  }

  return runtimeDependencies
}

async function readProjectPackageJson(project: ExtensionProject): Promise<ProjectPackageJson> {
  const value = await readJsonFile(project.packageJsonPath)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CliError(`${project.packageJsonPath} must contain a JSON object.`)
  }
  return value as ProjectPackageJson
}

function addRuntimeDependencies(
  dependencies: Map<string, ExtensionRuntimeDependency>,
  values: Record<string, unknown> | undefined,
  optional: boolean
): void {
  if (!values) {
    return
  }

  for (const [name, spec] of Object.entries(values)) {
    if (typeof spec !== 'string' || !spec.trim()) {
      throw new CliError(`Runtime dependency "${name}" must use a non-empty version string.`)
    }
    dependencies.set(name, {
      name,
      optional: optional || dependencies.get(name)?.optional === true,
      spec
    })
  }
}
