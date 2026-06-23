import { mkdir, rm } from 'node:fs/promises'

/** Recreates a built-in extension output directory. */
export async function resetOutputRoot(outputRoot: string): Promise<void> {
  await rm(outputRoot, { recursive: true, force: true })
  await mkdir(outputRoot, { recursive: true })
}
