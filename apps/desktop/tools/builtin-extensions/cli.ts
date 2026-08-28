#!/usr/bin/env tsx

import { buildBuiltinExtensions } from './build'
import { createBuiltinExtensionToolContext } from './context'
import type { BuiltinExtensionBuildTarget } from './types'

void main().catch((error: unknown) => {
  console.error('[builtin-extensions]', error)
  process.exit(1)
})

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  const context = createBuiltinExtensionToolContext()

  if (command === 'build') {
    await buildBuiltinExtensions(context, parseTarget(args))
    return
  }

  throw new Error('Usage: builtin-extensions build [--target=dev|resources]')
}

function parseTarget(args: string[]): BuiltinExtensionBuildTarget {
  const targetArg = args.find((arg) => arg.startsWith('--target='))
  const target = targetArg ? targetArg.slice('--target='.length) : 'dev'

  if (target === 'dev' || target === 'resources') {
    return target
  }

  throw new Error(`Unknown built-in extension output target: ${target}`)
}
