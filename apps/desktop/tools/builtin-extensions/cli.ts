#!/usr/bin/env tsx

import { buildBuiltinExtensions } from './build'
import { createBuiltinExtensionToolContext } from './context'
import { watchBuiltinExtensions } from './watch'
import type { BuiltinExtensionBuildTarget } from './types'

void main().catch((error: unknown) => {
  console.error('[builtin-extensions]', error instanceof Error ? error.message : error)
  process.exit(1)
})

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  const context = createBuiltinExtensionToolContext()

  if (command === 'build') {
    await buildBuiltinExtensions(context, parseTarget(args))
    return
  }

  if (command === 'watch') {
    const childCommand = parseChildCommand(args)
    if (childCommand.length === 0) {
      throw new Error('watch requires a command after --')
    }

    await watchBuiltinExtensions(context, childCommand)
    return
  }

  throw new Error('Usage: builtin-extensions <build|watch>')
}

function parseTarget(args: string[]): BuiltinExtensionBuildTarget {
  const targetArg = args.find((arg) => arg.startsWith('--target='))
  const target = targetArg ? targetArg.slice('--target='.length) : 'dev'

  if (target === 'dev' || target === 'resources') {
    return target
  }

  throw new Error(`Unknown built-in extension output target: ${target}`)
}

function parseChildCommand(args: string[]): string[] {
  const separatorIndex = args.indexOf('--')
  if (separatorIndex === -1) {
    return []
  }

  return args.slice(separatorIndex + 1)
}
