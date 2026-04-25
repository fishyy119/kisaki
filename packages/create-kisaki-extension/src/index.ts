import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCreateExtensionCli } from './cli'

const packageDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

void runCreateExtensionCli(process.argv, {
  templateDir: path.join(packageDir, 'templates/default')
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
