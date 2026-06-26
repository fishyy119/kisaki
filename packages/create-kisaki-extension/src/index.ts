import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCreateExtensionCli } from './cli/program'
import { cliOutput } from './cli/tui/output'
import { createPromptUi } from './cli/tui/prompts'
import { readPackageVersion } from './package-version'

const packageDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

void runCreateExtensionCli(process.argv, {
  templateDir: path.join(packageDir, 'templates'),
  toolingVersion: readPackageVersion(),
  prompts: createPromptUi()
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown scaffold error.'
  cliOutput.error(message)
  process.exit(1)
})
