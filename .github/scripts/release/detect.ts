import { readCommand, writeGithubOutput } from './common'
import { getReleaseMetadata, requireReleaseTarget } from './targets'

const RELEASE_SUBJECT_PATTERN =
  /^release\((desktop|extension-tooling)\): v([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)$/

const subject = readCommand('git', ['log', '-1', '--pretty=%s'])
const match = RELEASE_SUBJECT_PATTERN.exec(subject)

if (!match) {
  writeGithubOutput({ should_release: false })
  console.log('No release commit detected.')
  process.exit(0)
}

const target = requireReleaseTarget(match[1]!)
const version = match[2]!
const metadata = getReleaseMetadata(target, version)

writeGithubOutput({
  should_release: true,
  target,
  version,
  tag: metadata.tag,
  tag_prefix: metadata.tagPrefix,
  release_name: metadata.releaseName,
  is_prerelease: metadata.isPrerelease,
  make_latest: metadata.makeLatest
})
console.log(
  `Detected release: ${target} v${version} (prerelease=${metadata.isPrerelease}, make_latest=${metadata.makeLatest}).`
)
