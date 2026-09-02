import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { readRequiredEnv } from './shared'

const artifactDir = readRequiredEnv('RELEASE_ARTIFACT_DIR')
const checksumsPath = path.join(artifactDir, 'SHA256SUMS')
const lines = readFileSync(checksumsPath, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)

for (const line of lines) {
  const match = /^([a-f0-9]{64})\s+\*?(.+)$/.exec(line)
  if (!match) {
    throw new Error(`Invalid checksum line: ${line}`)
  }

  const expectedSha256 = match[1]!
  const fileName = match[2]!
  const filePath = path.join(artifactDir, fileName)
  const actualSha256 = createHash('sha256').update(readFileSync(filePath)).digest('hex')
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `Checksum mismatch for ${fileName}: ${actualSha256}, expected ${expectedSha256}.`
    )
  }
}

console.log(`Verified ${lines.length} checksum(s).`)
