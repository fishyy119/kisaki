import { bold, cyan, dim, green, red, yellow } from 'kolorist'

export interface PrintableIssue {
  path?: string
  message: string
}

export const logger = {
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
