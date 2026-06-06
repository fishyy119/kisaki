import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import PouchDB from 'pouchdb'
import { analyzeVniteBackupArchive } from '../src/backup/analyzer'
import { VnitePouchStore } from '../src/backup/pouch'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

interface ZipEntry {
  name: string
  data: Buffer
}

async function main(): Promise<void> {
  await runSyntheticFixture()

  const realArchivePath = process.argv[2]
  if (realArchivePath) {
    await runOptionalRealSmoke(realArchivePath)
  }
}

async function runSyntheticFixture(): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'kisaki-vnite-importer-'))

  try {
    const backupRoot = path.join(tempRoot, 'fixture', 'vnite-database-20260603')
    await createSyntheticVniteBackup(backupRoot)

    const cover = await new VnitePouchStore(backupRoot).getAttachment(
      'game',
      'game-alpha',
      'images/cover.webp'
    )
    assert.equal(cover.toString('utf8'), 'cover-alpha')

    const archivePath = path.join(tempRoot, 'vnite-database-20260603.zip')
    await writeZipFromDirectory(backupRoot, archivePath, 'vnite-database-20260603')

    const result = await analyzeVniteBackupArchive({
      archivePath,
      workspaceRoot: path.join(tempRoot, 'work')
    })

    assert.equal(result.snapshot.games.length, 2)
    assert.equal(result.snapshot.gameLocals.length, 2)
    assert.equal(result.snapshot.collections.length, 1)
    assert.equal(result.summary.statistics.games.total, 2)
    assert.equal(result.summary.statistics.collections.memberLinks, 2)
    assert.equal(result.summary.statistics.attachments.total, 5)
    assert.equal(result.summary.statistics.attachments.cover, 1)
    assert.equal(result.summary.statistics.attachments.backdrop, 1)
    assert.equal(result.summary.statistics.attachments.icon, 1)
    assert.equal(result.summary.statistics.attachments.memoryImages, 1)
    assert.equal(result.summary.statistics.attachments.wideCover, 1)
    assert.equal(result.summary.statistics.externalIds.steam, 1)
    assert.equal(result.summary.statistics.externalIds.vndb, 1)
    assert.equal(result.summary.statistics.externalIds.ymgal, 1)
    assert.equal(result.summary.statistics.games.withMarkPathOnly, 1)
    assert.equal(result.summary.statistics.gameLocals.withMultipleSavePaths, 1)
    assertHasDiagnostic(result.summary.diagnostics, 'vnite.status.unknown')
    assertHasDiagnostic(result.summary.diagnostics, 'vnite.save.attachmentMissing')
    assertHasDiagnostic(result.summary.diagnostics, 'vnite.save.multiplePaths')
    assertHasDiagnostic(result.summary.diagnostics, 'vnite.media.wideCoverUnsupported')
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

async function runOptionalRealSmoke(archivePath: string): Promise<void> {
  const resolvedArchivePath = await resolveExistingPath(archivePath)

  if (!resolvedArchivePath) {
    console.log(`Real backup smoke skipped: ${archivePath} was not found.`)
    return
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'kisaki-vnite-importer-real-'))

  try {
    const result = await analyzeVniteBackupArchive({
      archivePath: resolvedArchivePath,
      workspaceRoot: path.join(tempRoot, 'work')
    })
    console.log(
      `Real backup smoke: ${result.summary.statistics.games.total} games, ` +
        `${result.summary.statistics.collections.total} collections, ` +
        `${result.summary.statistics.attachments.total} attachments.`
    )
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

async function resolveExistingPath(inputPath: string): Promise<string | undefined> {
  const candidates = [path.resolve(inputPath), path.resolve(REPO_ROOT, inputPath)]

  for (const candidate of [...new Set(candidates)]) {
    try {
      await stat(candidate)
      return candidate
    } catch {
      continue
    }
  }

  return undefined
}

async function createSyntheticVniteBackup(backupRoot: string): Promise<void> {
  await mkdir(backupRoot, { recursive: true })
  await createGameDb(path.join(backupRoot, 'game'))
  await createGameLocalDb(path.join(backupRoot, 'game-local'))
  await createCollectionDb(path.join(backupRoot, 'game-collection'))
}

async function createGameDb(dbPath: string): Promise<void> {
  const db = new PouchDB(dbPath)

  try {
    await db.put({
      _id: 'game-alpha',
      metadata: {
        name: 'Alpha',
        originalName: 'Alpha Original',
        sortName: 'Alpha',
        releaseDate: '2026-01-02',
        description: '<p>Alpha</p>',
        developers: ['Studio A'],
        publishers: ['Publisher A'],
        platforms: ['windows'],
        genres: ['visual novel'],
        tags: ['favorite'],
        relatedSites: [{ label: 'Site', url: 'https://example.test/alpha' }],
        steamId: '123',
        vndbId: 'v456',
        igdbId: '',
        ymgalId: '789',
        extra: [{ key: 'Director', value: ['Person A'] }]
      },
      record: {
        addDate: '2026-01-01T00:00:00.000Z',
        lastRunDate: '2026-02-01T00:00:00.000Z',
        score: 8.5,
        playTime: 3600000,
        playStatus: 'playing',
        hideFromRecentGames: false,
        timers: [{ start: '2026-02-01T00:00:00.000Z', end: '2026-02-01T01:00:00.000Z' }],
        dailyPlayTimes: [],
        storageSize: 128
      },
      save: {
        saveList: {
          save1: { _id: 'save1', date: '2026-02-02T00:00:00.000Z', note: 'Save', locked: false }
        },
        maxBackups: 20,
        autoRestoreSave: false
      },
      memory: {
        memoryList: {
          mem1: { _id: 'mem1', date: '2026-02-03T00:00:00.000Z', note: 'Memory' }
        }
      },
      apperance: {
        logo: { position: { x: 0.5, y: 0.5 }, size: 1, visible: true },
        nsfw: true
      }
    })
    await putAttachment(db, 'game-alpha', 'images/cover.webp', 'cover-alpha')
    await putAttachment(db, 'game-alpha', 'images/background.webp', 'backdrop-alpha')
    await putAttachment(db, 'game-alpha', 'images/memories/mem1.webp', 'memory-alpha')
    await putAttachment(db, 'game-alpha', 'images/wideCover.webp', 'wide-alpha')

    await db.put({
      _id: 'game-beta',
      metadata: {
        name: 'Beta',
        ymgalId: ''
      },
      record: {
        playStatus: 'mystery'
      },
      save: {},
      memory: {},
      apperance: {}
    })
    await putAttachment(db, 'game-beta', 'images/icon.webp', 'icon-beta')
  } finally {
    await db.close()
  }
}

async function createGameLocalDb(dbPath: string): Promise<void> {
  const db = new PouchDB(dbPath)

  try {
    await db.put({
      _id: 'game-alpha',
      path: {
        gamePath: 'D:/Games/Alpha/alpha.exe',
        savePaths: ['D:/Saves/Alpha', 'E:/ExtraSaves/Alpha']
      },
      launcher: {
        mode: 'file',
        fileConfig: {
          path: 'D:/Games/Alpha/alpha.exe',
          args: ['--safe'],
          monitorMode: 'process',
          monitorPath: 'alpha.exe',
          workingDirectory: 'D:/Games/Alpha'
        },
        useMagpie: true
      },
      utils: {
        markPath: 'D:/Games/Alpha',
        rootPath: 'D:/Games/Alpha'
      }
    })
    await db.put({
      _id: 'game-beta',
      path: {
        gamePath: '',
        savePaths: []
      },
      launcher: {
        mode: 'url',
        urlConfig: {
          url: 'https://example.test/beta',
          browserPath: '',
          monitorMode: 'process',
          monitorPath: ''
        }
      },
      utils: {
        markPath: 'D:/Marks/Beta',
        rootPath: ''
      }
    })
  } finally {
    await db.close()
  }
}

async function createCollectionDb(dbPath: string): Promise<void> {
  const db = new PouchDB(dbPath)

  try {
    await db.put({
      _id: 'collection-main',
      name: 'Main',
      sort: 10,
      sortBy: 'metadata.name',
      sortOrder: 'asc',
      games: ['game-alpha', 'game-beta']
    })
  } finally {
    await db.close()
  }
}

async function putAttachment(
  db: PouchDB.Database,
  docId: string,
  attachmentId: string,
  content: string
): Promise<void> {
  const doc = await db.get(docId)
  await db.putAttachment(docId, attachmentId, doc._rev, Buffer.from(content), 'image/webp')
}

function assertHasDiagnostic(diagnostics: readonly { code: string }[], expectedCode: string): void {
  assert.ok(
    diagnostics.some((diagnostic) => diagnostic.code === expectedCode),
    `Expected diagnostic ${expectedCode}.`
  )
}

async function writeZipFromDirectory(
  directoryPath: string,
  archivePath: string,
  rootEntryName: string
): Promise<void> {
  const entries = await collectZipEntries(directoryPath, rootEntryName)
  await writeZip(entries, archivePath)
}

async function collectZipEntries(
  directoryPath: string,
  prefix: string
): Promise<readonly ZipEntry[]> {
  const entries: ZipEntry[] = []
  const directoryEntries = await readdir(directoryPath, { withFileTypes: true })

  for (const entry of directoryEntries) {
    const entryPath = path.join(directoryPath, entry.name)
    const entryName = `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      entries.push(...(await collectZipEntries(entryPath, entryName)))
      continue
    }

    if (entry.isFile()) {
      entries.push({
        name: entryName.replace(/\\/g, '/'),
        data: await readFile(entryPath)
      })
    }
  }

  return entries
}

async function writeZip(entries: readonly ZipEntry[], archivePath: string): Promise<void> {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const crc = crc32(entry.data)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(entry.data.length, 18)
    localHeader.writeUInt32LE(entry.data.length, 22)
    localHeader.writeUInt16LE(name.length, 26)
    localHeader.writeUInt16LE(0, 28)
    localParts.push(localHeader, name, entry.data)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(entry.data.length, 20)
    centralHeader.writeUInt32LE(entry.data.length, 24)
    centralHeader.writeUInt16LE(name.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    centralParts.push(centralHeader, name)

    offset += localHeader.length + name.length + entry.data.length
  }

  const centralDirectory = concatBuffers(centralParts)
  const endOfCentralDirectory = Buffer.alloc(22)
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0)
  endOfCentralDirectory.writeUInt16LE(0, 4)
  endOfCentralDirectory.writeUInt16LE(0, 6)
  endOfCentralDirectory.writeUInt16LE(entries.length, 8)
  endOfCentralDirectory.writeUInt16LE(entries.length, 10)
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12)
  endOfCentralDirectory.writeUInt32LE(offset, 16)
  endOfCentralDirectory.writeUInt16LE(0, 20)

  const archive = concatBuffers([...localParts, centralDirectory, endOfCentralDirectory])
  await writeFile(archivePath, new Uint8Array(archive))
}

function concatBuffers(parts: readonly Buffer[]): Buffer {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const output = Buffer.allocUnsafe(totalLength)
  let offset = 0

  for (const part of parts) {
    offset += part.copy(output, offset)
  }

  return output
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff

  for (const byte of data) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff]
  }

  return (crc ^ 0xffffffff) >>> 0
}

const CRC32_TABLE = createCrc32Table()

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256)

  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }

  return table
}

void main()
