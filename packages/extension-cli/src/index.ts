import { runCli } from './cli/program'
import { CliError } from './errors'
import { logger } from './logger'
import { readPackageVersion } from './version'

void runCli(process.argv, { version: readPackageVersion() }).catch((error: unknown) => {
  if (error instanceof CliError) {
    if (error.message) {
      logger.error(error.message)
    }
    process.exit(1)
  }

  logger.error(error instanceof Error ? error.message : 'Unknown kisx error.')
  process.exit(1)
})
