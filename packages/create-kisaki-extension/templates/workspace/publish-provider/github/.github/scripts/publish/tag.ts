import { commandSucceeds, configureGitHubActionsAuthor, readRequiredEnv, run } from './common'

const tag = readRequiredEnv('PUBLISH_TAG')
const commitSha = readRequiredEnv('GITHUB_SHA')

if (commandSucceeds('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])) {
  console.log(`Reusing tag ${tag} at ${commitSha}.`)
} else {
  configureGitHubActionsAuthor()
  run('git', ['tag', tag, commitSha])
  run('git', ['push', 'origin', `refs/tags/${tag}`])
}
