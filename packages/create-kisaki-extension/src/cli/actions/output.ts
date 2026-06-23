import { bold, dim, green } from 'kolorist'

/** Reports a successfully generated repository or extension directory. */
export function printCreated(targetDir: string, installed: boolean): void {
  console.log()
  console.log(green('[ok]') + ` Created ${bold(targetDir)}`)
  if (!installed) {
    console.log(dim('  Run pnpm install before using the generated project.'))
  }
  console.log()
}
