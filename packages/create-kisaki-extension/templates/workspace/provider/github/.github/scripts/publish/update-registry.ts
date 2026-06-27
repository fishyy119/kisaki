import path from 'node:path'
import { readCommand, readRequiredEnv, resolveWorkspacePath, run } from './common'

const extensionId = readRequiredEnv('PUBLISH_EXTENSION_ID')
const extensionDir = resolveWorkspacePath(readRequiredEnv('PUBLISH_EXTENSION_DIR'))
const version = readRequiredEnv('PUBLISH_VERSION')
const tag = readRequiredEnv('PUBLISH_TAG')
const archivePath = readRequiredEnv('ARCHIVE_PATH')
const signaturePath = readRequiredEnv('SIGNATURE_PATH')
const repository = readRequiredEnv('GITHUB_REPOSITORY')
const commitSha = readRequiredEnv('GITHUB_SHA')
const workspaceDir = readRequiredEnv('GITHUB_WORKSPACE')
const registryManifestPath = path.join(workspaceDir, 'registry', 'manifest.json')
const artifactUrl = `https://github.com/${repository}/releases/download/${tag}/${extensionId}-${version}.kisx`
const publishedAt = readCommand('git', ['show', '-s', '--format=%cI', commitSha])
const kisx = ['--dir', extensionDir, 'exec', 'kisx'] as const

run('git', ['fetch', 'origin', 'main'])
run('git', ['checkout', '-B', 'publish-registry', 'origin/main'])
run('pnpm', [
  ...kisx,
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
])
run('pnpm', [...kisx, 'registry', 'validate', registryManifestPath])
