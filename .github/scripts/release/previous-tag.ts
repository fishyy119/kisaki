import { readCommand, readRequiredEnv, writeGithubOutput } from './shared'

const releaseTag = readRequiredEnv('RELEASE_TAG')
const tagPrefix = readRequiredEnv('RELEASE_TAG_PREFIX')
const tags = readCommand('git', ['tag', '--list', `${tagPrefix}*`, '--sort=-v:refname'])
  .split(/\r?\n/)
  .map((tag) => tag.trim())
  .filter(Boolean)
const previousTag = tags.find((tag) => tag !== releaseTag) ?? ''

writeGithubOutput({ tag: previousTag })

if (previousTag) {
  console.log(`Found previous release tag: ${previousTag}`)
} else {
  console.log('No previous release tag found.')
}
