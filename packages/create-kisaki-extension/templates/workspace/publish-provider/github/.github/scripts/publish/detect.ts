import { readCommand, writeGithubOutput } from './common'

const PUBLISH_SUBJECT_PATTERN =
  /^publish\(([a-z0-9][a-z0-9.-]*)\): v([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)$/

const subject = readCommand('git', ['log', '-1', '--pretty=%s'])
const match = PUBLISH_SUBJECT_PATTERN.exec(subject)

if (!match) {
  writeGithubOutput({ should_publish: false })
  console.log('No extension publish commit detected.')
  process.exit(0)
}

const extensionId = match[1]!
const version = match[2]!

writeGithubOutput({
  should_publish: true,
  extension_id: extensionId,
  extension_dir: `extensions/${extensionId}`,
  version,
  tag: `${extensionId}-v${version}`
})
console.log(`Detected extension publish ${extensionId}@${version}.`)
