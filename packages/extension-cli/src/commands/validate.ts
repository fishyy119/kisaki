import { logger } from '../logger'
import { resolveProject, validateManifest } from '../project'

/**
 * Validates the current extension project.
 */
export async function validateCommand(): Promise<void> {
  const project = await resolveProject()

  logger.heading('kisx validate', 'Validating extension manifest and project files.')
  const result = await validateManifest(project, { checkEntry: true, checkProjectFiles: true })

  logger.issues('error', result.errors)
  logger.issues('warn', result.warnings)

  if (result.errors.length > 0) {
    process.exitCode = 1
    logger.error('Extension validation failed.')
    return
  }

  logger.success('Extension project is valid.')
}
