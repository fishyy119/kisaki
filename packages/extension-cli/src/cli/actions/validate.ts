import { logger } from '../../logger'
import { resolveProject, validateManifest } from '../../project'

/** Input accepted by the project validation action. */
export interface ValidateOptions {
  project?: string
}

/** Validates an extension project and reports its issues. */
export async function runValidate(options: ValidateOptions): Promise<void> {
  const project = await resolveProject(options.project)

  logger.heading('kisx validate', 'Validating extension manifest and project files.')
  const result = await validateManifest(project, {
    checkBuiltEntry: true,
    checkBuiltUi: true,
    checkProjectFiles: true
  })

  logger.issues('error', result.errors)
  logger.issues('warn', result.warnings)

  if (result.errors.length > 0) {
    process.exitCode = 1
    logger.error('Extension validation failed.')
    return
  }

  logger.success('Extension project is valid.')
}
