import { loadConfigFromFile, type ConfigEnv } from 'vite'
import type { KisxConfig } from '../config'
import { CliError } from '../errors'
import type { ExtensionProject } from '../project'
import { pathExists } from '../project'

const KISX_CONFIG_KEYS = ['host', 'ui'] as const satisfies readonly (keyof KisxConfig)[]
const KISX_CONFIG_KEY_SET: ReadonlySet<string> = new Set(KISX_CONFIG_KEYS)

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

  return requireKisxConfig(loaded.config)
}

function requireKisxConfig(value: unknown): KisxConfig {
  if (!isConfigObject(value)) {
    throw new CliError('kisx.config.ts must export a KisxConfig object.')
  }

  const unknownKeys = Object.keys(value).filter((key) => !KISX_CONFIG_KEY_SET.has(key))
  if (unknownKeys.length > 0) {
    throw new CliError(
      `kisx.config.ts contains unknown options: ${unknownKeys.map((key) => JSON.stringify(key)).join(', ')}. Valid options: ${KISX_CONFIG_KEYS.map((key) => JSON.stringify(key)).join(', ')}.`
    )
  }

  for (const key of KISX_CONFIG_KEYS) {
    if (value[key] !== undefined && !isConfigObject(value[key])) {
      throw new CliError(`kisx.config.ts option "${key}" must be a Vite config object.`)
    }
  }

  return value as KisxConfig
}

function isConfigObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
