import { logger } from '../logger'
import { readValidManifest, resolveProject } from '../project'
import { buildExtensionBundles, loadKisxConfig } from '../build'

/**
 * Builds the current extension with Vite.
 */
export async function buildCommand(): Promise<void> {
  const project = await resolveProject()

  logger.heading('kisx build', 'Building extension with Vite.')
  const manifest = await readValidManifest(project, { checkEntry: false, checkProjectFiles: true })
  const config = await loadKisxConfig(project)
  await buildExtensionBundles(project, manifest, config)
  await readValidManifest(project, { checkEntry: true })
  logger.success('Extension build completed.')
}
