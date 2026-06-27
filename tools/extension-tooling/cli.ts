#!/usr/bin/env tsx

import { buildTooling, verifyToolingOutput } from './build'
import { checkTooling, parseToolingVersionArgument, setToolingVersion } from './contract'
import { loadToolingWorkspace, type ToolingPackage } from './workspace'

const [command, ...args] = process.argv.slice(2)

void main().catch((error: unknown) => {
  console.error(`[extension-tooling] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})

async function main(): Promise<void> {
  const workspace = loadToolingWorkspace(process.cwd())

  switch (command) {
    case 'check':
      assertArgumentCount(command, args, 0, 1)
      checkTooling(workspace, args[0])
      return
    case 'set-version':
      assertArgumentCount(command, args, 1, 1)
      setToolingVersion(workspace, parseToolingVersionArgument(requireArgument(args, 0)))
      return
    case 'build':
      assertArgumentCount(command, args, 0, 0)
      await buildTooling(workspace)
      return
    case 'verify-output':
      assertArgumentCount(command, args, 0, 0)
      verifyToolingOutput(workspace)
      return
    case 'list':
      assertArgumentCount(command, args, 0, 0)
      listToolingPackages(workspace.manifest.packages)
      return
    default:
      printUsage(command)
      process.exitCode = command ? 1 : 0
  }
}

function requireArgument(args: readonly string[], index: number): string {
  const value = args[index]
  if (value === undefined) {
    throw new Error('Missing required argument.')
  }
  return value
}

function assertArgumentCount(
  commandName: string,
  commandArgs: readonly string[],
  minimum: number,
  maximum: number
): void {
  if (commandArgs.length < minimum || commandArgs.length > maximum) {
    throw new Error(`Invalid arguments for ${commandName}.`)
  }
}

function listToolingPackages(packages: readonly ToolingPackage[]): void {
  for (const toolingPackage of packages) {
    console.log(toolingPackage.name)
  }
}

function printUsage(receivedCommand: string | undefined): void {
  if (receivedCommand) {
    console.error(`[extension-tooling] Unknown command: ${receivedCommand}`)
  }

  console.log(`Usage:
  tsx tools/extension-tooling/cli.ts check [version]
  tsx tools/extension-tooling/cli.ts set-version <version>
  tsx tools/extension-tooling/cli.ts build
  tsx tools/extension-tooling/cli.ts verify-output
  tsx tools/extension-tooling/cli.ts list`)
}
