import { existsSync } from 'node:fs'
import { checkTooling } from './contract'
import { runAsync } from './process'
import {
  getPackageDirectory,
  requireToolingPackage,
  resolveWorkspacePath,
  type ToolingWorkspace
} from './workspace'

export async function buildTooling(workspace: ToolingWorkspace): Promise<void> {
  checkTooling(workspace)

  for (const packageGroup of workspace.manifest.buildPackageGroups) {
    await Promise.all(
      packageGroup.map((packageName) => {
        const toolingPackage = requireToolingPackage(workspace, packageName)
        console.log(`[extension-tooling] Building ${toolingPackage.name}...`)
        return runAsync('pnpm', ['run', 'build'], getPackageDirectory(workspace, toolingPackage))
      })
    )
  }
}

export function verifyToolingOutput(workspace: ToolingWorkspace): void {
  const missingPaths = workspace.manifest.outputPaths.filter(
    (outputPath) => !existsSync(resolveWorkspacePath(workspace, outputPath))
  )
  if (missingPaths.length > 0) {
    throw new Error(
      `Missing extension tooling output files:\n${missingPaths
        .map((outputPath) => `  - ${outputPath}`)
        .join('\n')}`
    )
  }

  console.log(`[extension-tooling] Verified ${workspace.manifest.outputPaths.length} output files.`)
}
