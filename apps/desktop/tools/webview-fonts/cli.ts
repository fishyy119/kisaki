#!/usr/bin/env tsx

import { buildWebviewFonts } from './build'
import { createWebviewFontToolContext } from './paths'

void main().catch((error: unknown) => {
  console.error('[webview-fonts]', error instanceof Error ? error.message : error)
  process.exit(1)
})

async function main(): Promise<void> {
  const [command] = process.argv.slice(2)
  const context = createWebviewFontToolContext()

  if (command === 'build') {
    await buildWebviewFonts(context)
    return
  }

  throw new Error('Usage: webview-fonts build')
}
