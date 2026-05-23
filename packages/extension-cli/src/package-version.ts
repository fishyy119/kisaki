import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function readPackageVersion(): string {
  const packageDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
  const packageJsonPath = path.join(packageDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version?: unknown }

  if (typeof packageJson.version !== 'string') {
    throw new Error('package.json version must be a string.')
  }

  return packageJson.version
}
