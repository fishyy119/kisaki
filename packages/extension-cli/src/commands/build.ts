import { logger } from '../logger'
import { readValidManifest } from '../manifest'
import { resolveProject } from '../project'
import { runTsdown } from './tsdown'

/**
 * Builds the current extension with tsdown.
 */
export async function buildCommand(): Promise<void> {
  const project = await resolveProject()

  logger.heading('kisx build', 'Building extension with tsdown.')
  await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  await runTsdown(project.rootDir, [])
  await readValidManifest(project, { checkEntry: true })
  logger.success('Extension build completed.')
}
