import { loadConfigFromFile, type ConfigEnv } from 'vite'
import type { KisxConfig } from '../config'
import { CliError } from '../logger'
import type { ExtensionProject } from '../project'
import { pathExists } from '../project'

/**
 * Loads the optional kisx.config.ts of an extension project.
 */
export async function loadKisxConfig(
  project: ExtensionProject,
  env: ConfigEnv = { command: 'build', mode: 'production' }
): Promise<KisxConfig> {
  if (!(await pathExists(project.kisxConfigPath))) {
    return {}
  }

  const loaded = await loadConfigFromFile(env, project.kisxConfigPath, project.rootDir)
  if (!loaded) {
    throw new CliError('kisx.config.ts could not be loaded.')
  }

  const config = loaded.config as KisxConfig
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new CliError('kisx.config.ts must export a KisxConfig object.')
  }

  return config
}
