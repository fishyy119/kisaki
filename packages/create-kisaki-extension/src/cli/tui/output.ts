import { bold, cyan, dim, green, red, yellow } from 'kolorist'

export interface PrintableIssue {
  path?: string
  message: string
}

/**
 * Terminal output facade. Mirrors the `logger` surface from
 * @kisaki3/extension-cli so both scaffold and extension CLIs share one output
 * vocabulary: heading banners, dim detail lines, bracketed status prefixes,
 * and printable issue lists.
 */
export const cliOutput = {
  heading(title: string, subtitle?: string): void {
    console.log()
    console.log(bold(cyan(`  ${title}`)))
    if (subtitle) {
      console.log(dim(`  ${subtitle}`))
    }
    console.log()
  },

  detail(message: string): void {
    console.log(dim(`  ${message}`))
  },

  success(message: string): void {
    console.log(green('[ok]') + ` ${message}`)
  },

  warn(message: string): void {
    console.log(yellow('[warn]') + ` ${message}`)
  },

  error(message: string): void {
    console.error(red('[error]') + ` ${message}`)
  },

  issues(kind: 'error' | 'warn', issues: readonly PrintableIssue[]): void {
    for (const issue of issues) {
      const prefix = kind === 'error' ? red('[error]') : yellow('[warn]')
      const location = issue.path ? `${issue.path}: ` : ''
      console.log(`${prefix} ${location}${issue.message}`)
    }
  }
}

/** Reports a successfully generated repository or extension directory. */
export function printCreated(targetDir: string, installed: boolean): void {
  console.log()
  cliOutput.success(`Created ${bold(targetDir)}`)
  if (!installed) {
    cliOutput.detail('Run pnpm install before using the generated project.')
  }
  console.log()
}
