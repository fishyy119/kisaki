import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { commandSucceeds, readCommand, readRequiredEnv } from './common'
import { getReleaseTargetDefinition, readReleaseTarget, type ReleaseTarget } from './targets'

const REQUIRED_CHANGELOG_FILES = ['en.md', 'ja.md', 'zh-Hans.md'] as const
const PLACEHOLDER_PATTERN =
  /(^|[^A-Za-z0-9])(TBD|TODO)([^A-Za-z0-9]|$)|^\s*[-*]\s*(?:\.\.\.|……)\s*$/im

const target = readReleaseTarget()
const version = readRequiredEnv('RELEASE_VERSION')
const tag = readRequiredEnv('RELEASE_TAG')
const commitSha = readRequiredEnv('GITHUB_SHA')

validateReleaseTag(tag, commitSha)
validateChangelogFiles(target, version)

function validateReleaseTag(releaseTag: string, expectedSha: string): void {
  if (!commandSucceeds('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${releaseTag}`])) {
    console.log(`Tag ${releaseTag} is available.`)
    return
  }

  const tagCommit = readCommand('git', ['rev-list', '-n', '1', releaseTag])
  if (tagCommit !== expectedSha) {
    throw new Error(`Tag ${releaseTag} points to ${tagCommit}, expected ${expectedSha}.`)
  }

  console.log(`Tag ${releaseTag} already identifies this release commit.`)
}

function validateChangelogFiles(releaseTarget: ReleaseTarget, releaseVersion: string): void {
  const changelogDir = path.join('changelog', releaseTarget, `v${releaseVersion}`)
  const expectedTitle = getReleaseTargetDefinition(releaseTarget).changelogTitle(releaseVersion)
  const missingFiles: string[] = []
  const invalidFiles: string[] = []

  for (const fileName of REQUIRED_CHANGELOG_FILES) {
    const filePath = path.join(changelogDir, fileName)
    if (!existsSync(filePath)) {
      missingFiles.push(filePath)
      continue
    }

    const content = readFileSync(filePath, 'utf8')
    const firstLine = content.split(/\r?\n/, 1)[0]
    if (
      firstLine !== expectedTitle ||
      content.trim().length === 0 ||
      PLACEHOLDER_PATTERN.test(content)
    ) {
      invalidFiles.push(filePath)
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `Missing required changelog files for ${releaseTarget} v${releaseVersion}:\n${missingFiles
        .map((file) => `  - ${file}`)
        .join('\n')}`
    )
  }

  if (invalidFiles.length > 0) {
    throw new Error(
      `Invalid title, empty content, or placeholder text in changelog files:\n${invalidFiles
        .map((file) => `  - ${file}`)
        .join('\n')}`
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
