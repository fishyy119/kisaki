import assert from 'node:assert/strict'
import path from 'node:path'
import { buildVniteLibraryGraph } from '../src/import'
import {
  createVniteAttachmentPathKey,
  createVniteEdgeIdentity,
  joinVniteScriptCommand,
  mapVniteCompanies,
  mapVniteExternalIds,
  mapVniteLocalGameFields,
  mapVnitePersonsFromExtra,
  mapVnitePlayStatus,
  mapVniteTags,
  parseVnitePartialDate,
  parseVniteTimestamp,
  toKisakiScore
} from '../src/mapping'
import type { VniteAttachmentMetadata } from '../src/vnite/attachments'
import type { VniteBackupGame, VniteBackupSnapshot } from '../src/backup/types'
import { createDefaultVniteGameDoc, createDefaultVniteGameLocalDoc } from '../src/vnite/defaults'
import { normalizeVniteGameDoc } from '../src/vnite/normalization'

function main(): void {
  testDateMapping()
  testScalarMapping()
  testLocalMapping()
  testTagsCompaniesAndPeople()
  testGraphBuilder()
}

function testDateMapping(): void {
  assert.deepEqual(parseVnitePartialDate('2026-01-02', { field: 'release' }).value, {
    year: 2026,
    month: 1,
    day: 2
  })
  assert.equal(
    parseVnitePartialDate('2026-02-30', { field: 'release' }).diagnostics[0]?.code,
    'vnite.date.invalid'
  )

  const timestamp = parseVniteTimestamp('2026-02-01T00:00:00.000Z', { field: 'played' }).value
  assert.equal(timestamp, Date.parse('2026-02-01T00:00:00.000Z'))
  assert.equal(
    parseVniteTimestamp('not a date', { field: 'played' }).diagnostics[0]?.code,
    'vnite.date.invalid'
  )
}

function testScalarMapping(): void {
  const game = createGame('scalar')
  game.doc.metadata.steamId = ' 123 '
  game.doc.metadata.vndbId = 'v456'
  game.doc.metadata.ymgalId = '789'

  assert.equal(mapVnitePlayStatus('unplayed'), 'notStarted')
  assert.equal(mapVnitePlayStatus('playing'), 'inProgress')
  assert.equal(toKisakiScore(8.5), 85)
  assert.equal(toKisakiScore(-1), null)
  assert.deepEqual(mapVniteExternalIds(game, { includeMetadataIds: true }), [
    { source: 'vnite', id: 'scalar' },
    { source: 'steam', id: '123' },
    { source: 'vndb', id: 'v456' },
    { source: 'ymgal', id: '789' }
  ])
  assert.deepEqual(mapVniteExternalIds(game, { includeMetadataIds: false }), [
    { source: 'vnite', id: 'scalar' }
  ])

  const normalized = normalizeVniteGameDoc({
    _id: 'unknown-status',
    record: { playStatus: 'mystery' }
  })
  assert.equal(normalized.value?.doc.record.playStatus, 'unplayed')
  assert.equal(normalized.issues[0]?.code, 'vnite.status.unknown')
}

function testLocalMapping(): void {
  const local = createDefaultVniteGameLocalDoc('local')
  local.path.gamePath = 'D:/Games/Alpha/alpha.exe'
  local.path.savePaths = ['D:/Saves/Alpha', 'E:/MoreSaves/Alpha']
  local.path.screenshotPath = 'D:/Shots/Alpha'
  local.launcher.fileConfig.args = ['--safe']
  local.launcher.fileConfig.monitorMode = 'process'
  local.launcher.fileConfig.monitorPath = 'alpha.exe'
  local.launcher.useMagpie = true
  local.utils.rootPath = 'D:/Games/Alpha'

  const result = mapVniteLocalGameFields(
    { id: 'local', doc: local },
    {
      includeLauncher: true,
      includeGameDirPath: true,
      includeSavePath: true,
      nodeKey: 'vnite:game:local'
    }
  )

  assert.equal(result.input.launcherMode, 'file')
  assert.equal(result.input.launcherPath, 'D:/Games/Alpha/alpha.exe')
  assert.equal(result.input.monitorMode, 'process')
  assert.equal(result.input.gameDirPath, 'D:/Games/Alpha')
  assert.equal(result.input.savePath, 'D:/Saves/Alpha')
  assertHasDiagnostic(result.diagnostics, 'vnite.launch.argsUnsupported')
  assertHasDiagnostic(result.diagnostics, 'vnite.launch.magpieUnsupported')
  assertHasDiagnostic(result.diagnostics, 'vnite.save.multiplePaths')
  assertHasDiagnostic(result.diagnostics, 'vnite.local.screenshotPathUnsupported')

  assert.equal(joinVniteScriptCommand(['node', 'my script.js']), 'node "my script.js"')
}

function testTagsCompaniesAndPeople(): void {
  const game = createGame('credits')
  game.doc.metadata.tags = ['favorite', 'favorite']
  game.doc.metadata.genres = ['visual novel']
  game.doc.metadata.platforms = ['windows']
  game.doc.metadata.developers = ['Studio A', 'Studio A']
  game.doc.metadata.publishers = ['Publisher A']
  game.doc.metadata.extra = [
    { key: 'Director', value: ['Alice', 'Alice'] },
    { key: '原画', value: ['Bob'] },
    { key: 'engine', value: ['RenPy'] },
    { key: 'unknown', value: ['value'] }
  ]

  assert.deepEqual(
    mapVniteTags(game.doc.metadata, {
      includeTags: true,
      includeGenres: true,
      includePlatforms: true,
      includeEngineExtras: true
    }).map((tag) => tag.name),
    ['favorite', 'visual novel', 'windows', 'RenPy']
  )
  assert.deepEqual(mapVniteCompanies(game.doc.metadata), [
    { name: 'Studio A', role: 'developer' },
    { name: 'Publisher A', role: 'publisher' }
  ])

  const people = mapVnitePersonsFromExtra(game.doc.metadata.extra)
  assert.deepEqual(people.people, [
    { name: 'Alice', role: 'director', sourceKey: 'Director' },
    { name: 'Bob', role: 'illustration', sourceKey: '原画' }
  ])
  assert.equal(people.unknownExtras.length, 1)
}

function testGraphBuilder(): void {
  const snapshot = createSnapshot()
  const attachmentPaths = new Map<string, string>()
  for (const game of snapshot.games) {
    for (const attachment of game.attachments) {
      attachmentPaths.set(
        createVniteAttachmentPathKey(game.id, attachment.id),
        path.resolve('tmp', 'vnite-import-test', game.id, attachment.id.replace(/\//g, '_'))
      )
    }
  }
  attachmentPaths.delete(createVniteAttachmentPathKey('beta', 'saves/missing.zip'))

  const graph = buildVniteLibraryGraph({
    snapshot,
    fieldSelection: {
      credits: {
        personsFromExtra: true,
        unknownExtraAsNotes: true
      },
      media: {
        descriptionImages: true
      },
      organization: {
        platformsAsTags: true
      },
      saves: {
        saveBackups: true
      }
    },
    resolveAttachmentPath: ({ gameId, attachmentId }) =>
      attachmentPaths.get(createVniteAttachmentPathKey(gameId, attachmentId))
  })

  assert.equal(graph.options?.conflictMode, 'mergeSelected')
  assert.equal(graph.nodes.media?.length, 2)
  assert.equal(graph.nodes.collections?.length, 1)
  assert.equal(graph.nodes.sessions?.length, 1)
  assert.equal(graph.nodes.attachments?.length, 4)
  assert.equal(graph.edges?.filter((edge) => edge.kind === 'collection-media').length, 2)
  assert.equal(graph.edges?.filter((edge) => edge.kind === 'media-attachment').length, 4)

  const alpha = graph.nodes.media?.find((node) => node.key === 'vnite:game:alpha')
  assert.equal(alpha?.input.name, 'Alpha')
  assert.deepEqual(alpha?.input.releaseDate, { year: 2026, month: 1, day: 2 })
  assert.equal(alpha?.input.score, 85)
  assert.equal(alpha?.input.status, 'inProgress')
  assert.equal(alpha?.input.maxSaveBackups, 20)

  const tags = graph.nodes.tags?.map((node) => node.input.name).sort() ?? []
  assert.deepEqual(tags, ['RenPy', 'favorite', 'visual novel', 'windows'])
  assert.equal(graph.nodes.companies?.length, 2)
  assert.equal(graph.nodes.people?.length, 1)
  assert.ok(graph.nodes.notes?.some((node) => node.input.name.startsWith('Vnite 回忆 ')))
  assert.ok(graph.nodes.notes?.some((node) => node.input.name === 'Vnite 额外信息'))

  assertHasDiagnostic(graph.diagnostics ?? [], 'vnite.date.invalid')
  assertHasDiagnostic(graph.diagnostics ?? [], 'vnite.save.multiplePaths')
  assertHasDiagnostic(graph.diagnostics ?? [], 'vnite.save.attachmentMissing')
  assertHasDiagnostic(graph.diagnostics ?? [], 'vnite.media.wideCoverUnsupported')
  assertHasDiagnostic(graph.diagnostics ?? [], 'vnite.collection.sortUnsupported')

  const nodeKeys = [
    ...(graph.nodes.media ?? []),
    ...(graph.nodes.collections ?? []),
    ...(graph.nodes.tags ?? []),
    ...(graph.nodes.companies ?? []),
    ...(graph.nodes.people ?? []),
    ...(graph.nodes.notes ?? []),
    ...(graph.nodes.sessions ?? []),
    ...(graph.nodes.attachments ?? [])
  ].map((node) => node.key)
  assert.equal(new Set(nodeKeys).size, nodeKeys.length)
  const edgeIdentities = (graph.edges ?? []).map(createVniteEdgeIdentity)
  assert.equal(new Set(edgeIdentities).size, edgeIdentities.length)
}

function createSnapshot(): VniteBackupSnapshot {
  const alpha = createGame('alpha')
  alpha.doc.metadata.name = 'Alpha'
  alpha.doc.metadata.originalName = 'Alpha Original'
  alpha.doc.metadata.releaseDate = '2026-01-02'
  alpha.doc.metadata.description = '<p>Alpha</p>'
  alpha.doc.metadata.relatedSites = [{ label: 'Site', url: 'https://example.test/alpha' }]
  alpha.doc.metadata.tags = ['favorite']
  alpha.doc.metadata.genres = ['visual novel']
  alpha.doc.metadata.platforms = ['windows']
  alpha.doc.metadata.developers = ['Studio A']
  alpha.doc.metadata.publishers = ['Publisher A']
  alpha.doc.metadata.steamId = '123'
  alpha.doc.metadata.extra = [
    { key: 'Director', value: ['Alice'] },
    { key: 'engine', value: ['RenPy'] },
    { key: 'unknown', value: ['value'] }
  ]
  alpha.doc.record.addDate = '2026-01-01T00:00:00.000Z'
  alpha.doc.record.lastRunDate = '2026-02-01T00:00:00.000Z'
  alpha.doc.record.score = 8.5
  alpha.doc.record.playTime = 3600000
  alpha.doc.record.playStatus = 'playing'
  alpha.doc.record.timers = [
    { start: '2026-02-01T00:00:00.000Z', end: '2026-02-01T01:00:00.000Z' },
    { start: '2026-02-02T01:00:00.000Z', end: '2026-02-02T00:00:00.000Z' }
  ]
  alpha.doc.save.maxBackups = 20
  alpha.doc.save.saveList = {
    save1: { _id: 'save1', date: '2026-02-02T00:00:00.000Z', note: 'Save', locked: false }
  }
  alpha.doc.memory.memoryList = {
    mem1: { _id: 'mem1', date: '2026-02-03T00:00:00.000Z', note: 'Memory' }
  }
  alpha.local = { id: 'alpha', doc: createDefaultVniteGameLocalDoc('alpha') }
  alpha.local.doc.path.gamePath = 'D:/Games/Alpha/alpha.exe'
  alpha.local.doc.path.savePaths = ['D:/Saves/Alpha', 'E:/MoreSaves/Alpha']
  alpha.local.doc.utils.rootPath = 'D:/Games/Alpha'
  alpha.attachments = [
    attachment('images/cover.webp', 'media', { slot: 'cover' }),
    attachment('images/background.webp', 'media', { slot: 'backdrop' }),
    attachment('images/description/hash.webp', 'description-image', { imageId: 'hash' }),
    attachment('images/memories/mem1.webp', 'memory-cover', { memoryId: 'mem1' }),
    attachment('saves/save1.zip', 'save-archive', { saveId: 'save1' }),
    attachment('images/wideCover.webp', 'unsupported')
  ]
  alpha.attachmentIds = alpha.attachments.map((item) => item.id)

  const beta = createGame('beta')
  beta.doc.metadata.name = ''
  beta.doc.metadata.originalName = ''
  beta.doc.metadata.releaseDate = '2026-02-30'
  beta.doc.save.saveList = {
    missing: {
      _id: 'missing',
      date: '2026-03-01T00:00:00.000Z',
      note: 'Missing',
      locked: true
    }
  }

  return {
    rootPath: 'fixture',
    games: [alpha, beta],
    gameLocals: [alpha.local.doc, createDefaultVniteGameLocalDoc('beta')].map((doc) => ({
      id: doc._id,
      doc
    })),
    collections: [
      {
        id: 'collection-main',
        doc: {
          _id: 'collection-main',
          name: 'Main',
          sort: 10,
          sortBy: 'metadata.name',
          sortOrder: 'asc',
          games: ['alpha', 'beta']
        }
      }
    ],
    diagnostics: [],
    readAt: Date.now()
  }
}

function createGame(id: string): VniteBackupGame {
  const doc = createDefaultVniteGameDoc(id)
  return {
    id,
    doc,
    attachmentIds: [],
    attachments: [],
    diagnostics: []
  }
}

function attachment(
  id: string,
  category: VniteAttachmentMetadata['category'],
  extra: Partial<VniteAttachmentMetadata> = {}
): VniteAttachmentMetadata {
  return {
    id,
    category,
    contentType: id.endsWith('.zip') ? 'application/zip' : 'image/webp',
    ...extra
  }
}

function assertHasDiagnostic(diagnostics: readonly { code: string }[], expectedCode: string): void {
  assert.ok(
    diagnostics.some((diagnostic) => diagnostic.code === expectedCode),
    `Expected diagnostic ${expectedCode}.`
  )
}

main()
