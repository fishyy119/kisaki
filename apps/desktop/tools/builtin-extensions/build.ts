import { findBuiltinExtensionProjects } from './projects'
import { outputBuiltinExtension } from './kisx'
import { resetOutputRoot } from './output'
import { resolveBuiltinExtensionOutputRoot } from './paths'
import { prepareExtensionDebugPackages } from './tooling'
import type { BuiltinExtensionBuildTarget, BuiltinExtensionToolContext } from './types'

/** Builds built-in extensions into the selected desktop output directory. */
export async function buildBuiltinExtensions(
  context: BuiltinExtensionToolContext,
  target: BuiltinExtensionBuildTarget
): Promise<void> {
  const outputRoot = resolveBuiltinExtensionOutputRoot(context, target)
  const debugSources = target === 'dev'
  const projects = await findBuiltinExtensionProjects(context)
  await resetOutputRoot(outputRoot)
  await prepareExtensionDebugPackages(context, outputRoot, debugSources, projects)

  if (projects.length === 0) {
    console.log(
      `[builtin-extensions] No built-in extensions found in ${context.builtinExtensionsRoot}`
    )
    return
  }

  console.log(`[builtin-extensions] Building ${projects.length} built-in extension(s)`)
  await Promise.all(projects.map((project) => outputBuiltinExtension(project, outputRoot)))
}
