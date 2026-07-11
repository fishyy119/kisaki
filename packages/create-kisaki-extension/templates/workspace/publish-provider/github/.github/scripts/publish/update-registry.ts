import path from 'node:path'
import { readCommand, readRequiredEnv, run } from './common'

const extensionId = readRequiredEnv('PUBLISH_EXTENSION_ID')
const version = readRequiredEnv('PUBLISH_VERSION')
const tag = readRequiredEnv('PUBLISH_TAG')
const archivePath = readRequiredEnv('ARCHIVE_PATH')
const signaturePath = readRequiredEnv('SIGNATURE_PATH')
const repository = readRequiredEnv('GITHUB_REPOSITORY')
const workspaceDir = readRequiredEnv('GITHUB_WORKSPACE')
const registryManifestPath = path.join(workspaceDir, 'registry', 'manifest.json')
const artifactUrl = `https://github.com/${repository}/releases/download/${tag}/${extensionId}-${version}.kisx`
const tagCommit = readCommand('git', ['rev-list', '-n', '1', tag])
const publishedAt = new Date(
  readCommand('git', ['show', '-s', '--format=%cI', tagCommit])
).toISOString()

run('git', ['fetch', 'origin', 'main'])
run('git', ['checkout', '-B', 'publish-registry', 'origin/main'])
const addReleaseArgs = [
  'registry',
  'add-release',
  archivePath,
  '--manifest',
  registryManifestPath,
  '--url',
  artifactUrl,
  '--published-at',
  publishedAt,
  '--signature',
  signaturePath
]
run('pnpm', ['exec', 'kisx', ...addReleaseArgs])
run('pnpm', ['exec', 'kisx', 'registry', 'validate', registryManifestPath])
