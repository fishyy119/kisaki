import type {
  LibraryAnime,
  LibraryAnimeCreateInput,
  LibraryAnimePatch,
  LibraryCharacter,
  LibraryCharacterCreateInput,
  LibraryCharacterPatch,
  LibraryCollection,
  LibraryCollectionCreateInput,
  LibraryCollectionPatch,
  LibraryCompany,
  LibraryCompanyCreateInput,
  LibraryCompanyPatch,
  LibraryGame,
  LibraryGameCreateInput,
  LibraryGamePatch,
  LibraryGraphResultAction,
  LibraryMovie,
  LibraryMovieCreateInput,
  LibraryMoviePatch,
  LibraryPerson,
  LibraryPersonCreateInput,
  LibraryPersonPatch,
  LibraryTag,
  LibraryTagCreateInput,
  LibraryTagPatch,
  LibraryTv,
  LibraryTvCreateInput,
  LibraryTvPatch
} from '@kisaki3/extension-api'
import { normalizeExternalIds } from '@shared/identity'
import type { NormalizedLibraryGraph } from '../types'

type ConflictMode = NormalizedLibraryGraph['options']['conflictMode']

export function planGameAction(
  existing: LibraryGame | undefined,
  input: LibraryGameCreateInput,
  conflictMode: ConflictMode
): LibraryGraphResultAction {
  if (!existing) {
    return 'create'
  }

  return Object.keys(buildGamePatch(existing, input, conflictMode)).length > 0 ? 'update' : 'skip'
}

export function planAnimeAction(
  existing: LibraryAnime | undefined,
  input: LibraryAnimeCreateInput,
  conflictMode: ConflictMode
): LibraryGraphResultAction {
  if (!existing) {
    return 'create'
  }

  return Object.keys(buildAnimePatch(existing, input, conflictMode)).length > 0 ? 'update' : 'skip'
}

export function planTvAction(
  existing: LibraryTv | undefined,
  input: LibraryTvCreateInput,
  conflictMode: ConflictMode
): LibraryGraphResultAction {
  if (!existing) {
    return 'create'
  }

  return Object.keys(buildTvPatch(existing, input, conflictMode)).length > 0 ? 'update' : 'skip'
}

export function planMovieAction(
  existing: LibraryMovie | undefined,
  input: LibraryMovieCreateInput,
  conflictMode: ConflictMode
): LibraryGraphResultAction {
  if (!existing) {
    return 'create'
  }

  return Object.keys(buildMoviePatch(existing, input, conflictMode)).length > 0 ? 'update' : 'skip'
}

export function planCollectionAction(
  existing: LibraryCollection | undefined,
  input: LibraryCollectionCreateInput,
  conflictMode: ConflictMode
): LibraryGraphResultAction {
  if (!existing) return 'create'
  return Object.keys(buildCollectionPatch(existing, input, conflictMode)).length > 0
    ? 'update'
    : 'skip'
}

export function planTagAction(
  existing: LibraryTag | undefined,
  input: LibraryTagCreateInput,
  conflictMode: ConflictMode
): LibraryGraphResultAction {
  if (!existing) return 'create'
  return Object.keys(buildTagPatch(existing, input, conflictMode)).length > 0 ? 'update' : 'skip'
}

export function planRankedEntityAction(
  existing: LibraryCharacter | LibraryCompany | LibraryPerson | undefined,
  input: LibraryCharacterCreateInput | LibraryCompanyCreateInput | LibraryPersonCreateInput,
  conflictMode: ConflictMode
): LibraryGraphResultAction {
  if (!existing) return 'create'
  return Object.keys(buildRankedEntityPatch(existing, input, conflictMode)).length > 0
    ? 'update'
    : 'skip'
}

export function buildGamePatch(
  existing: LibraryGame,
  input: LibraryGameCreateInput,
  conflictMode: ConflictMode
): LibraryGamePatch {
  const patch = buildRankedEntityPatch(existing, input, conflictMode) as LibraryGamePatch
  assignPatchValue(patch, existing, input, 'releaseDate', conflictMode)
  assignPatchValue(patch, existing, input, 'status', conflictMode)
  assignPatchValue(patch, existing, input, 'lastActiveAt', conflictMode)
  assignPatchValue(patch, existing, input, 'totalDuration', conflictMode)
  assignPatchValue(patch, existing, input, 'savePath', conflictMode)
  assignPatchValue(patch, existing, input, 'saveBackups', conflictMode)
  assignPatchValue(patch, existing, input, 'maxSaveBackups', conflictMode)
  assignPatchValue(patch, existing, input, 'launcherMode', conflictMode)
  assignPatchValue(patch, existing, input, 'launcherPath', conflictMode)
  assignPatchValue(patch, existing, input, 'monitorMode', conflictMode)
  assignPatchValue(patch, existing, input, 'monitorPath', conflictMode)
  assignPatchValue(patch, existing, input, 'gameDirPath', conflictMode)
  assignPatchValue(patch, existing, input, 'descriptionInlineFiles', conflictMode)
  patch.externalIds = mergeExternalIds(existing.externalIds, input.externalIds)
  if (areExternalIdsEqual(patch.externalIds, existing.externalIds)) {
    delete patch.externalIds
  }
  return patch
}

export function buildAnimePatch(
  existing: LibraryAnime,
  input: LibraryAnimeCreateInput,
  conflictMode: ConflictMode
): LibraryAnimePatch {
  const patch = buildRankedEntityPatch(existing, input, conflictMode) as LibraryAnimePatch
  assignPatchValue(patch, existing, input, 'releaseDate', conflictMode)
  assignPatchValue(patch, existing, input, 'status', conflictMode)
  assignPatchValue(patch, existing, input, 'format', conflictMode)
  assignPatchValue(patch, existing, input, 'totalEpisodes', conflictMode)
  assignPatchValue(patch, existing, input, 'lastActiveAt', conflictMode)
  assignPatchValue(patch, existing, input, 'totalDuration', conflictMode)
  assignPatchValue(patch, existing, input, 'animeDirPath', conflictMode)
  assignPatchValue(patch, existing, input, 'descriptionInlineFiles', conflictMode)
  patch.externalIds = mergeExternalIds(existing.externalIds, input.externalIds)
  if (areExternalIdsEqual(patch.externalIds, existing.externalIds)) {
    delete patch.externalIds
  }
  return patch
}

export function buildTvPatch(
  existing: LibraryTv,
  input: LibraryTvCreateInput,
  conflictMode: ConflictMode
): LibraryTvPatch {
  const patch = buildRankedEntityPatch(existing, input, conflictMode) as LibraryTvPatch
  assignPatchValue(patch, existing, input, 'releaseDate', conflictMode)
  assignPatchValue(patch, existing, input, 'endDate', conflictMode)
  assignPatchValue(patch, existing, input, 'status', conflictMode)
  assignPatchValue(patch, existing, input, 'format', conflictMode)
  assignPatchValue(patch, existing, input, 'totalSeasons', conflictMode)
  assignPatchValue(patch, existing, input, 'totalEpisodes', conflictMode)
  assignPatchValue(patch, existing, input, 'lastActiveAt', conflictMode)
  assignPatchValue(patch, existing, input, 'totalDuration', conflictMode)
  assignPatchValue(patch, existing, input, 'tvDirPath', conflictMode)
  assignPatchValue(patch, existing, input, 'descriptionInlineFiles', conflictMode)
  patch.externalIds = mergeExternalIds(existing.externalIds, input.externalIds)
  if (areExternalIdsEqual(patch.externalIds, existing.externalIds)) {
    delete patch.externalIds
  }
  return patch
}

export function buildMoviePatch(
  existing: LibraryMovie,
  input: LibraryMovieCreateInput,
  conflictMode: ConflictMode
): LibraryMoviePatch {
  const patch = buildRankedEntityPatch(existing, input, conflictMode) as LibraryMoviePatch
  assignPatchValue(patch, existing, input, 'releaseDate', conflictMode)
  assignPatchValue(patch, existing, input, 'status', conflictMode)
  assignPatchValue(patch, existing, input, 'format', conflictMode)
  assignPatchValue(patch, existing, input, 'runtimeMs', conflictMode)
  assignPatchValue(patch, existing, input, 'watched', conflictMode)
  assignPatchValue(patch, existing, input, 'watchedAt', conflictMode)
  assignPatchValue(patch, existing, input, 'playCount', conflictMode)
  assignPatchValue(patch, existing, input, 'resumePositionMs', conflictMode)
  assignPatchValue(patch, existing, input, 'lastActiveAt', conflictMode)
  assignPatchValue(patch, existing, input, 'totalDuration', conflictMode)
  assignPatchValue(patch, existing, input, 'movieDirPath', conflictMode)
  assignPatchValue(patch, existing, input, 'descriptionInlineFiles', conflictMode)
  patch.externalIds = mergeExternalIds(existing.externalIds, input.externalIds)
  if (areExternalIdsEqual(patch.externalIds, existing.externalIds)) {
    delete patch.externalIds
  }
  return patch
}

export function buildCollectionPatch(
  existing: LibraryCollection,
  input: LibraryCollectionCreateInput,
  conflictMode: ConflictMode
): LibraryCollectionPatch {
  const patch: LibraryCollectionPatch = {}
  assignPatchValue(patch, existing, input, 'name', conflictMode)
  assignPatchValue(patch, existing, input, 'description', conflictMode)
  assignPatchValue(patch, existing, input, 'coverFile', conflictMode)
  assignPatchValue(patch, existing, input, 'isNsfw', conflictMode)
  assignPatchValue(patch, existing, input, 'order', conflictMode)
  assignPatchValue(patch, existing, input, 'isDynamic', conflictMode)
  assignPatchValue(patch, existing, input, 'dynamicConfig', conflictMode)
  return patch
}

export function buildTagPatch(
  existing: LibraryTag,
  input: LibraryTagCreateInput,
  conflictMode: ConflictMode
): LibraryTagPatch {
  const patch: LibraryTagPatch = {}
  assignPatchValue(patch, existing, input, 'name', conflictMode)
  assignPatchValue(patch, existing, input, 'description', conflictMode)
  assignPatchValue(patch, existing, input, 'isNsfw', conflictMode)
  return patch
}

export function buildCompanyPatch(
  existing: LibraryCompany,
  input: LibraryCompanyCreateInput,
  conflictMode: ConflictMode
): LibraryCompanyPatch {
  const patch = buildRankedEntityPatch(existing, input, conflictMode) as LibraryCompanyPatch
  assignPatchValue(patch, existing, input, 'foundedDate', conflictMode)
  assignPatchValue(patch, existing, input, 'logoFile', conflictMode)
  return patch
}

export function buildPersonPatch(
  existing: LibraryPerson,
  input: LibraryPersonCreateInput,
  conflictMode: ConflictMode
): LibraryPersonPatch {
  const patch = buildRankedEntityPatch(existing, input, conflictMode) as LibraryPersonPatch
  assignPatchValue(patch, existing, input, 'photoFile', conflictMode)
  assignPatchValue(patch, existing, input, 'birthDate', conflictMode)
  assignPatchValue(patch, existing, input, 'deathDate', conflictMode)
  assignPatchValue(patch, existing, input, 'gender', conflictMode)
  return patch
}

export function buildCharacterPatch(
  existing: LibraryCharacter,
  input: LibraryCharacterCreateInput,
  conflictMode: ConflictMode
): LibraryCharacterPatch {
  const patch = buildRankedEntityPatch(existing, input, conflictMode) as LibraryCharacterPatch
  assignPatchValue(patch, existing, input, 'photoFile', conflictMode)
  assignPatchValue(patch, existing, input, 'birthDate', conflictMode)
  assignPatchValue(patch, existing, input, 'gender', conflictMode)
  assignPatchValue(patch, existing, input, 'bloodType', conflictMode)
  assignPatchValue(patch, existing, input, 'height', conflictMode)
  assignPatchValue(patch, existing, input, 'weight', conflictMode)
  assignPatchValue(patch, existing, input, 'bust', conflictMode)
  assignPatchValue(patch, existing, input, 'waist', conflictMode)
  assignPatchValue(patch, existing, input, 'hips', conflictMode)
  assignPatchValue(patch, existing, input, 'cup', conflictMode)
  assignPatchValue(patch, existing, input, 'age', conflictMode)
  return patch
}

export function shouldOverwriteValue(
  existing: unknown,
  incoming: unknown,
  conflictMode: ConflictMode
): boolean {
  if (incoming === undefined || conflictMode === 'skipExisting') {
    return false
  }
  if (conflictMode === 'mergeSelected' && !isMissingValue(existing)) {
    return false
  }
  return !areValuesEqual(existing, incoming)
}

export function planOrderUpdate(
  currentOrder: number,
  incomingOrder: number | undefined
): LibraryGraphResultAction {
  return incomingOrder !== undefined && currentOrder !== incomingOrder ? 'update' : 'skip'
}

export function shouldReplaceAttachment(
  replace: boolean | undefined,
  conflictMode: ConflictMode
): boolean {
  return replace ?? conflictMode === 'overwriteSelected'
}

export function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const result: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      result[key] = entry
    }
  }
  return result as T
}

type RankedEntityPatch =
  | LibraryAnimePatch
  | LibraryCharacterPatch
  | LibraryCompanyPatch
  | LibraryGamePatch
  | LibraryMoviePatch
  | LibraryPersonPatch
  | LibraryTvPatch

function buildRankedEntityPatch(
  existing:
    | LibraryAnime
    | LibraryCharacter
    | LibraryCompany
    | LibraryGame
    | LibraryMovie
    | LibraryPerson
    | LibraryTv,
  input:
    | LibraryAnimeCreateInput
    | LibraryCharacterCreateInput
    | LibraryCompanyCreateInput
    | LibraryGameCreateInput
    | LibraryMovieCreateInput
    | LibraryPersonCreateInput
    | LibraryTvCreateInput,
  conflictMode: ConflictMode
): RankedEntityPatch {
  const patch: RankedEntityPatch = {}
  assignPatchValue(patch, existing, input, 'name', conflictMode)
  assignPatchValue(patch, existing, input, 'description', conflictMode)
  assignPatchValue(patch, existing, input, 'originalName', conflictMode)
  assignPatchValue(patch, existing, input, 'sortName', conflictMode)
  assignPatchValue(patch, existing, input, 'score', conflictMode)
  assignPatchValue(patch, existing, input, 'isFavorite', conflictMode)
  assignPatchValue(patch, existing, input, 'isNsfw', conflictMode)
  assignPatchValue(patch, existing, input, 'externalSites', conflictMode)
  patch.externalIds = mergeExternalIds(existing.externalIds, input.externalIds)
  if (areExternalIdsEqual(patch.externalIds, existing.externalIds)) {
    delete patch.externalIds
  }
  return patch
}

function assignPatchValue(
  patch: object,
  existing: object,
  input: object,
  key: string,
  conflictMode: ConflictMode
): void {
  const patchRecord = patch as Record<string, unknown>
  const existingRecord = existing as Record<string, unknown>
  const inputRecord = input as Record<string, unknown>
  if (!Object.hasOwn(inputRecord, key) || inputRecord[key] === undefined) {
    return
  }
  if (conflictMode === 'skipExisting') {
    return
  }
  if (conflictMode === 'mergeSelected' && !isMissingValue(existingRecord[key])) {
    return
  }
  if (areValuesEqual(existingRecord[key], inputRecord[key])) {
    return
  }

  patchRecord[key] = inputRecord[key]
}

function isMissingValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

function mergeExternalIds(
  existing: readonly { source: string; id: string }[],
  incoming: readonly { source: string; id: string }[] | undefined
): { source: string; id: string }[] {
  return normalizeExternalIds([...existing, ...(incoming ?? [])])
}

function areExternalIdsEqual(
  left: readonly { source: string; id: string }[],
  right: readonly { source: string; id: string }[]
): boolean {
  return areValuesEqual(normalizeExternalIds([...left]), normalizeExternalIds([...right]))
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
