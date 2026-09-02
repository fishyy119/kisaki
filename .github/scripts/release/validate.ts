import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { commandSucceeds, readCommand, readRequiredEnv } from './shared'
import { getReleaseTargetDefinition, readReleaseTarget, type ReleaseTarget } from './targets'

const REQUIRED_CHANGELOG_FILES = ['en.md', 'ja.md', 'zh-Hans.md'] as const
type ChangelogFileName = (typeof REQUIRED_CHANGELOG_FILES)[number]

const PLACEHOLDER_PATTERN =
  /(^|[^A-Za-z0-9])(TBD|TODO)([^A-Za-z0-9]|$)|^\s*[-*]\s*(?:\.\.\.|……)\s*$/im
const CHANGELOG_ENTRY_PREFIXES: Record<ChangelogFileName, readonly string[]> = {
  'en.md': [
    'Added',
    'Supported',
    'Fixed',
    'Improved',
    'Optimized',
    'Refactored',
    'Changed',
    'Removed',
    'Required'
  ],
  'ja.md': ['追加', '対応', '修正', '改善', '最適化', '再構成', '変更', '削除', '必須化'],
  'zh-Hans.md': ['新增', '支持', '修复', '改进', '优化', '重构', '调整', '移除', '要求']
}
const SCOPE_PREFIX_PATTERN = /^[^:：]{1,60}[:：]\s*(.+)$/u
const ZH_HANS_TERMINAL_PUNCTUATION_PATTERN = /[。.!！?？]$/u

const target = readReleaseTarget()
const version = readRequiredEnv('RELEASE_VERSION')
const tag = readRequiredEnv('RELEASE_TAG')

validateReleaseTag(tag)
validateChangelogFiles(target, version)

function validateReleaseTag(releaseTag: string): void {
  if (!commandSucceeds('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${releaseTag}`])) {
    throw new Error(`Release tag does not exist: ${releaseTag}.`)
  }

  const tagCommit = readCommand('git', ['rev-list', '-n', '1', releaseTag])
  const headCommit = readCommand('git', ['rev-parse', 'HEAD'])
  if (tagCommit !== headCommit) {
    throw new Error(`Tag ${releaseTag} points to ${tagCommit}, but checkout is ${headCommit}.`)
  }

  console.log(`Verified release tag ${releaseTag} at ${headCommit}.`)
}

function validateChangelogFiles(releaseTarget: ReleaseTarget, releaseVersion: string): void {
  const changelogDir = path.join('changelog', releaseTarget, `v${releaseVersion}`)
  const expectedTitle = getReleaseTargetDefinition(releaseTarget).changelogTitle(releaseVersion)
  const missingFiles: string[] = []
  const invalidIssues: string[] = []

  for (const fileName of REQUIRED_CHANGELOG_FILES) {
    const filePath = path.join(changelogDir, fileName)
    if (!existsSync(filePath)) {
      missingFiles.push(filePath)
      continue
    }

    const content = readFileSync(filePath, 'utf8')
    const [firstLine = ''] = content.split(/\r?\n/, 1)
    if (firstLine !== expectedTitle) {
      invalidIssues.push(`${filePath}: expected title "${expectedTitle}".`)
    }
    if (content.trim().length === 0) {
      invalidIssues.push(`${filePath}: changelog content must not be empty.`)
    }
    if (PLACEHOLDER_PATTERN.test(content)) {
      invalidIssues.push(`${filePath}: placeholder text must be removed.`)
    }
    if (releaseVersion !== '0.0.1') {
      invalidIssues.push(...validateChangelogEntryWording(fileName, filePath, content))
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `Missing required changelog files for ${releaseTarget} v${releaseVersion}:\n${missingFiles
        .map((file) => `  - ${file}`)
        .join('\n')}`
    )
  }

  if (invalidIssues.length > 0) {
    throw new Error(
      `Invalid changelog files:\n${invalidIssues.map((issue) => `  - ${issue}`).join('\n')}`
    )
  }

  const actualFiles = readdirSync(changelogDir)
    .filter((fileName) => fileName.endsWith('.md'))
    .toSorted()
  if (actualFiles.join('\n') !== [...REQUIRED_CHANGELOG_FILES].toSorted().join('\n')) {
    throw new Error(
      `Changelog directory must contain exactly: ${REQUIRED_CHANGELOG_FILES.join(
        ', '
      )}.\nFound: ${actualFiles.length > 0 ? actualFiles.join(', ') : '(none)'}`
    )
  }

  console.log(`Verified changelog files for ${releaseTarget} v${releaseVersion}.`)
}

function validateChangelogEntryWording(
  fileName: ChangelogFileName,
  filePath: string,
  content: string
): string[] {
  const issues: string[] = []
  const lines = content.split(/\r?\n/)

  lines.forEach((line, index) => {
    const bulletMatch = /^\s*-\s+(.+?)\s*$/.exec(line)
    if (bulletMatch === null) {
      return
    }

    const entry = bulletMatch[1] ?? ''
    if (!hasRequiredActionPrefix(fileName, entry)) {
      issues.push(
        `${filePath}:${index + 1}: bullet must start with ${formatActionPrefixes(fileName)}.`
      )
    }

    if (fileName === 'zh-Hans.md' && ZH_HANS_TERMINAL_PUNCTUATION_PATTERN.test(entry)) {
      issues.push(`${filePath}:${index + 1}: zh-Hans bullets must omit terminal punctuation.`)
    }
  })

  return issues
}

function hasRequiredActionPrefix(fileName: ChangelogFileName, entry: string): boolean {
  if (startsWithActionPrefix(fileName, entry)) {
    return true
  }

  const scopePrefixMatch = SCOPE_PREFIX_PATTERN.exec(entry)
  const scopedEntry = scopePrefixMatch?.[1]?.trim()
  return scopedEntry !== undefined && startsWithActionPrefix(fileName, scopedEntry)
}

function startsWithActionPrefix(fileName: ChangelogFileName, entry: string): boolean {
  const prefixes = CHANGELOG_ENTRY_PREFIXES[fileName]
  if (fileName === 'zh-Hans.md') {
    return prefixes.some(
      (prefix) =>
        entry === prefix ||
        (entry.startsWith(prefix) &&
          !entry.startsWith(`${prefix}:`) &&
          !entry.startsWith(`${prefix}：`))
    )
  }

  return prefixes.some((prefix) => entry === prefix || entry.startsWith(`${prefix} `))
}

function formatActionPrefixes(fileName: ChangelogFileName): string {
  return CHANGELOG_ENTRY_PREFIXES[fileName].join(', ')
}
