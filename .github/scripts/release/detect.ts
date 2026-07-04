import { readRequiredEnv, writeGithubOutput } from './common'
import { getReleaseMetadata, parseReleaseTag } from './targets'

const tag = readRequiredEnv('RELEASE_TAG')
const { target, version } = parseReleaseTag(tag)
const metadata = getReleaseMetadata(target, version)

writeGithubOutput({
  target,
  version,
  tag: metadata.tag,
  tag_prefix: metadata.tagPrefix,
  release_name: metadata.releaseName,
  is_prerelease: metadata.isPrerelease,
  make_latest: metadata.makeLatest
})
console.log(
  `Detected release tag: ${metadata.tag} (${target} v${version}, prerelease=${metadata.isPrerelease}, make_latest=${metadata.makeLatest}).`
)
