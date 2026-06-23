import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCreateExtensionCli } from './cli/program'
import { readPackageVersion } from './package-version'

const packageDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

void runCreateExtensionCli(process.argv, {
  templateDir: path.join(packageDir, 'templates'),
  toolingVersion: readPackageVersion()
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown scaffold error.'
  console.error(`[error] ${message}`)
  process.exit(1)
})
