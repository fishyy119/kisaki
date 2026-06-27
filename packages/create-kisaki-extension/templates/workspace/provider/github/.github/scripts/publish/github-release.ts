import { commandSucceeds, readRequiredEnv, run } from './common'

const tag = readRequiredEnv('PUBLISH_TAG')
const extensionId = readRequiredEnv('PUBLISH_EXTENSION_ID')
const version = readRequiredEnv('PUBLISH_VERSION')
const archivePath = readRequiredEnv('ARCHIVE_PATH')
const signaturePath = readRequiredEnv('SIGNATURE_PATH')
const commitSha = readRequiredEnv('GITHUB_SHA')

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
    `Kisaki extension package \`${extensionId}@${version}\`.`
  ]
  if (version.includes('-')) {
    args.push('--prerelease')
  }
  run('gh', args)
}

run('gh', ['release', 'upload', tag, archivePath, signaturePath, '--clobber'])
