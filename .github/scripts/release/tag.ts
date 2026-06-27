import {
  commandSucceeds,
  configureGitHubActionsAuthor,
  readCommand,
  readRequiredEnv,
  run
} from './common'

const tag = readRequiredEnv('RELEASE_TAG')
const commitSha = readRequiredEnv('GITHUB_SHA')

run('git', ['fetch', '--force', '--tags', 'origin'])

if (commandSucceeds('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])) {
  const tagCommit = readCommand('git', ['rev-list', '-n', '1', tag])
  if (tagCommit !== commitSha) {
    throw new Error(`Tag ${tag} points to ${tagCommit}, expected ${commitSha}.`)
  }

  console.log(`Reusing tag ${tag} at ${commitSha}.`)
} else {
  configureGitHubActionsAuthor()
  run('git', ['tag', tag, commitSha])
  run('git', ['push', 'origin', `refs/tags/${tag}`])
}
