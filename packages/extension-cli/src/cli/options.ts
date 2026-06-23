import type { Command } from 'commander'

/** Adds the root project option to command-local options when it was provided. */
export function withProjectOption<T extends object>(
  options: T,
  command: Command
): T & {
  project?: string
} {
  const project = command.optsWithGlobals<{ project?: string }>().project
  return { ...options, ...(project === undefined ? {} : { project }) }
}
