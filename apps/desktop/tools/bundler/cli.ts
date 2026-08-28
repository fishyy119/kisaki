#!/usr/bin/env tsx

import { runBuildWorkflow } from './build'
import { runDevWorkflow } from './dev'
import { createBundlerPaths } from './paths'
import { runStartWorkflow } from './start'

void main().catch((error: unknown) => {
  console.error('[bundler]', error)
  process.exit(1)
})

async function main(): Promise<void> {
  const [command] = process.argv.slice(2)
  const paths = createBundlerPaths()

  if (command === 'dev') {
    await runDevWorkflow(paths)
    return
  }

  if (command === 'build') {
    await runBuildWorkflow(paths)
    return
  }

  if (command === 'start') {
    await runStartWorkflow(paths)
    return
  }

  throw new Error('Usage: bundler <dev|build|start>')
}
