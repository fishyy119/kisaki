import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { readOptionalEnv, readRequiredEnv } from './common'
import { getReleaseTargetDefinition, readReleaseTarget } from './targets'

const previousTag = readOptionalEnv('PREVIOUS_TAG')
const target = readReleaseTarget()
const version = readRequiredEnv('RELEASE_VERSION')
const tag = readRequiredEnv('RELEASE_TAG')
const repository = readRequiredEnv('GITHUB_REPOSITORY')
const targetDefinition = getReleaseTargetDefinition(target)
const repoUrl = `https://github.com/${repository}`
const changelogBase = `${repoUrl}/blob/${tag}/changelog/${target}/v${version}`
const lines = [
  '## Changelog',
  '',
  `- [简体中文](${changelogBase}/zh-Hans.md)`,
  `- [English](${changelogBase}/en.md)`,
  `- [日本語](${changelogBase}/ja.md)`,
  ''
]

if (targetDefinition.includePackageSummary) {
  const packagesPath = path.join('artifacts', 'PACKAGES.md')
  if (!existsSync(packagesPath)) {
    throw new Error(`Release package summary not found: ${packagesPath}`)
  }

  lines.push(
    readFileSync(packagesPath, 'utf8').trimEnd(),
    '',
    '## Assets',
    '',
    '- npm package tarballs are attached to this release.',
    '- SHA256 checksums are available in `SHA256SUMS`.',
    ''
  )
}

if (previousTag) {
  lines.push(
    `**Full Changelog**: [\`${previousTag}...${tag}\`](${repoUrl}/compare/${previousTag}...${tag})`
  )
} else {
  lines.push(`**Full Changelog**: [\`View commits for ${tag}\`](${repoUrl}/commits/${tag})`)
}

writeFileSync('release-body.md', `${lines.join('\n')}\n`)
