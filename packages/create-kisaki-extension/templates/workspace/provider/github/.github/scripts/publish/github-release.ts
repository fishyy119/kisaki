import { commandSucceeds, readRequiredEnv, run } from './common'
import { createDefaultReleaseNotes, readReleaseChangelog } from './changelog'

const tag = readRequiredEnv('PUBLISH_TAG')
const extensionId = readRequiredEnv('PUBLISH_EXTENSION_ID')
const extensionDir = readRequiredEnv('PUBLISH_EXTENSION_DIR')
const version = readRequiredEnv('PUBLISH_VERSION')
const archivePath = readRequiredEnv('ARCHIVE_PATH')
const signaturePath = readRequiredEnv('SIGNATURE_PATH')
const commitSha = readRequiredEnv('GITHUB_SHA')
const changelog = readReleaseChangelog(extensionDir, version)
const releaseNotes = changelog?.releaseNotes ?? createDefaultReleaseNotes(extensionId, version)

readRequiredEnv('GH_TOKEN')

if (!commandSucceeds('gh', ['release', 'view', tag])) {
  const args = [
    'release',
    'create',
    tag,
    '--target',
    commitSha,
    '--title',
    `${extensionId} v${version}`,
    '--notes',
    releaseNotes
  ]
  if (version.includes('-')) {
    args.push('--prerelease')
  }
  run('gh', args)
}

run('gh', ['release', 'upload', tag, archivePath, signaturePath, '--clobber'])
