import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCreateExtensionCli } from './cli'
import { readPackageVersion } from './package-version'

const packageDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

void runCreateExtensionCli(process.argv, {
  templateDir: path.join(packageDir, 'templates/default'),
  toolingVersion: readPackageVersion()
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
