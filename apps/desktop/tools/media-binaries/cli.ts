#!/usr/bin/env tsx

import { fetchMediaBinaries } from './fetch'
import { createMediaBinaryToolContext } from './paths'
import { checkMediaBinaries, stageMediaBinaries } from './stage'

const USAGE = [
  'Usage:',
  '  media-binaries fetch                Download pinned mpv/ffprobe releases and stage them',
  '  media-binaries stage --from <dir>   Copy mpv/ffprobe into resources/bin/<platform>-<arch>',
  '  media-binaries check                Verify the current platform has every bundled tool'
].join('\n')

void main().catch((error: unknown) => {
  console.error('[media-binaries]', error instanceof Error ? error.message : error)
  process.exit(1)
})

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  const context = createMediaBinaryToolContext()

  if (command === 'fetch') {
    await fetchMediaBinaries(context)
    return
  }

  if (command === 'stage') {
    const sourceDir = readOption(args, '--from')
    if (!sourceDir) {
      throw new Error(`Missing --from <dir>\n${USAGE}`)
    }

    await stageMediaBinaries(context, sourceDir)
    return
  }

  if (command === 'check') {
    const statuses = await checkMediaBinaries(context)
    const missing = statuses.filter((status) => !status.present)

    if (missing.length > 0) {
      throw new Error(
        [
          `Missing bundled media tools for ${context.platform}-${context.arch}:`,
          ...missing.map((status) => `  ${status.executable} -> ${status.targetPath}`),
          'Run: pnpm --filter kisaki fetch:media-binaries (or stage:media-binaries --from <dir>)'
        ].join('\n')
      )
    }

    console.log(
      `[media-binaries] ${statuses.length} executable(s) ready for ${context.platform}-${context.arch}`
    )
    return
  }

  throw new Error(USAGE)
}

function readOption(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index >= 0) {
    return args[index + 1]
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`))
  return inline?.slice(flag.length + 1)
}
