import { runCli } from './cli'
import { CliError, logger } from './logger'

void runCli().catch((error: unknown) => {
  if (error instanceof CliError) {
    if (error.message) {
      logger.error(error.message)
    }
    process.exit(1)
  }

  logger.error(error instanceof Error ? error.message : 'Unknown kisx error.')
  process.exit(1)
})
