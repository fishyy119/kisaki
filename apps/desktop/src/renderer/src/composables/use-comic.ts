/**
 * Comic data composable
 *
 * Provides comic data with all related entities using Provider/Consumer pattern.
 * Two provider surfaces share one fetcher, context assembly, and db sync:
 * - Route page: `comicDetailData` loads during navigation (beforeResolve), the
 *   page consumes the settled store via `useComicRouteProvider()`.
 * - Dialog: `useComicDialogProvider()` fetches on demand after mount.
 */

import {
  provide,
  inject,
  ref,
  toRef,
  toValue,
  computed,
  watch,
  type InjectionKey,
  type Ref,
  type MaybeRefOrGetter,
  type ComputedRef
} from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { eq, asc, desc, and, inArray } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { useAsyncData } from './use-async-data'
import { usePreferencesStore } from '@renderer/stores'
import type {
  Comic,
  ComicChapter,
  ComicChapterFile,
  ComicNote,
  ComicSession,
  ComicCharacterLink,
  ComicPersonLink,
  ComicCompanyLink,
  ComicTagLink,
  Character,
  Person,
  Company,
  Tag
} from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import { fetchMediaRelations, type MediaRelationEntry } from '@renderer/core/db/media-relations'
import { useDbChanges } from './use-db-changes'

// =============================================================================
// Types
// =============================================================================

/** One readable unit with the container files it owns, ordered by preference. */
export interface ComicChapterEntry extends ComicChapter {
  files: ComicChapterFile[]
}

interface ComicData {
  comic: Comic | null
  chapters: ComicChapterEntry[]
  notes: ComicNote[]
  tags: (ComicTagLink & { tag: Tag | null })[]
  characters: (ComicCharacterLink & { character: Character | null })[]
  persons: (ComicPersonLink & { person: Person | null })[]
  companies: (ComicCompanyLink & { company: Company | null })[]
  relations: MediaRelationEntry[]
  sessions: ComicSession[]
}

export interface ComicContext {
  /** Comic data */
  comic: ComputedRef<Comic | null>
  /** Units in display order, each with its readable files */
  chapters: ComputedRef<ComicChapterEntry[]>
  /** Comic notes (from comicNotes) */
  notes: ComputedRef<ComicNote[]>
  /** Comic tags (from comicTagLinks) */
  tags: ComputedRef<(ComicTagLink & { tag: Tag | null })[]>
  /** Character links with character data */
  characters: ComputedRef<(ComicCharacterLink & { character: Character | null })[]>
  /** Person links with person data */
  persons: ComputedRef<(ComicPersonLink & { person: Person | null })[]>
  /** Company links with company data */
  companies: ComputedRef<(ComicCompanyLink & { company: Company | null })[]>
  /** Entry-to-entry relations merged from both edge directions */
  relations: ComputedRef<MediaRelationEntry[]>
  /** Comic sessions (reading history) */
  sessions: ComputedRef<ComicSession[]>
  /** Initial loading state (always false on the route surface after mount) */
  isLoading: Ref<boolean>
  /** Background refetching state */
  isFetching: Ref<boolean>
  /** Error if any */
  error: Ref<string | null>
  /** Manually refetch data */
  refetch: () => Promise<void>
}

export interface ComicProviderReturn extends ComicContext {
  /** Spoiler reveal state owned by the provider; toggling refetches (SWR) */
  spoilersRevealed: Ref<boolean>
}

// =============================================================================
// Injection Key
// =============================================================================

export const ComicKey: InjectionKey<ComicContext> = Symbol('comic')

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchComicData(
  comicId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<ComicData | null> {
  if (!comicId) return null

  const comicWhere = and(
    eq(schema.comics.id, comicId),
    showNsfw ? undefined : eq(schema.comics.isNsfw, false)
  )
  const [comicData] = await db.select().from(schema.comics).where(comicWhere).limit(1)

  if (!comicData) return null

  const comicTagLinksWhere = and(
    eq(schema.comicTagLinks.comicId, comicId),
    spoilersRevealed ? undefined : eq(schema.comicTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const comicCharacterLinksWhere = and(
    eq(schema.comicCharacterLinks.comicId, comicId),
    spoilersRevealed ? undefined : eq(schema.comicCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  const comicPersonLinksWhere = and(
    eq(schema.comicPersonLinks.comicId, comicId),
    spoilersRevealed ? undefined : eq(schema.comicPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  const comicCompanyLinksWhere = and(
    eq(schema.comicCompanyLinks.comicId, comicId),
    spoilersRevealed ? undefined : eq(schema.comicCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.companies.isNsfw, false)
  )

  const [chapters, notes, tagLinks, charLinks, personLinks, companyLinks, relations, sessions] =
    await Promise.all([
      db
        .select()
        .from(schema.comicChapters)
        .where(eq(schema.comicChapters.comicId, comicId))
        .orderBy(
          asc(schema.comicChapters.orderInComic),
          asc(schema.comicChapters.volumeNumber),
          asc(schema.comicChapters.chapterNumber)
        ),
      db
        .select()
        .from(schema.comicNotes)
        .where(eq(schema.comicNotes.comicId, comicId))
        .orderBy(asc(schema.comicNotes.orderInComic), asc(schema.comicNotes.name)),
      db
        .select()
        .from(schema.comicTagLinks)
        .leftJoin(schema.tags, eq(schema.comicTagLinks.tagId, schema.tags.id))
        .where(comicTagLinksWhere)
        .orderBy(asc(schema.comicTagLinks.orderInComic)),
      db
        .select()
        .from(schema.comicCharacterLinks)
        .leftJoin(
          schema.characters,
          eq(schema.comicCharacterLinks.characterId, schema.characters.id)
        )
        .where(comicCharacterLinksWhere)
        .orderBy(asc(schema.comicCharacterLinks.orderInComic)),
      db
        .select()
        .from(schema.comicPersonLinks)
        .leftJoin(schema.persons, eq(schema.comicPersonLinks.personId, schema.persons.id))
        .where(comicPersonLinksWhere)
        .orderBy(asc(schema.comicPersonLinks.orderInComic)),
      db
        .select()
        .from(schema.comicCompanyLinks)
        .leftJoin(schema.companies, eq(schema.comicCompanyLinks.companyId, schema.companies.id))
        .where(comicCompanyLinksWhere)
        .orderBy(asc(schema.comicCompanyLinks.orderInComic)),
      fetchMediaRelations('comic', comicId, showNsfw),
      db
        .select()
        .from(schema.comicSessions)
        .where(eq(schema.comicSessions.comicId, comicId))
        .orderBy(desc(schema.comicSessions.startedAt))
    ])

  return {
    comic: comicData,
    chapters: await attachChapterFiles(chapters),
    notes,
    tags: tagLinks.map((row) => ({ ...row.comic_tag_links, tag: row.tags })),
    characters: charLinks.map((row) => ({
      ...row.comic_character_links,
      character: row.characters
    })),
    persons: personLinks.map((row) => ({ ...row.comic_person_links, person: row.persons })),
    companies: companyLinks.map((row) => ({
      ...row.comic_company_links,
      company: row.companies
    })),
    relations,
    sessions
  }
}

/** Files are loaded in one query and grouped in memory to keep unit order stable. */
async function attachChapterFiles(chapters: ComicChapter[]): Promise<ComicChapterEntry[]> {
  if (chapters.length === 0) return []

  const files = await db
    .select()
    .from(schema.comicChapterFiles)
    .where(
      inArray(
        schema.comicChapterFiles.chapterId,
        chapters.map((chapter) => chapter.id)
      )
    )
    .orderBy(desc(schema.comicChapterFiles.isPrimary), asc(schema.comicChapterFiles.createdAt))

  const filesByChapter = new Map<string, ComicChapterFile[]>()
  for (const file of files) {
    const bucket = filesByChapter.get(file.chapterId)
    if (bucket) {
      bucket.push(file)
    } else {
      filesByChapter.set(file.chapterId, [file])
    }
  }

  return chapters.map((chapter) => ({ ...chapter, files: filesByChapter.get(chapter.id) ?? [] }))
}

// =============================================================================
// Route Loader
// =============================================================================

// Route-surface spoiler state lives beside the loader so the navigation-time
// fetch reads a consistent value; it resets whenever a different comic loads.
let lastRouteComicId: string | null = null
const routeSpoilersRevealed = ref(false)

export const comicDetailData = defineRouteData((route) => {
  const comicId = route.params.comicId as string
  if (comicId !== lastRouteComicId) {
    lastRouteComicId = comicId
    routeSpoilersRevealed.value = false
  }
  const { showNsfw } = storeToRefs(usePreferencesStore())
  return fetchComicData(comicId, routeSpoilersRevealed.value, showNsfw.value)
})

// =============================================================================
// Shared Internals
// =============================================================================

interface ComicDataSource {
  data: Readonly<Ref<ComicData | null | undefined>>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  error: Ref<string | null>
  refetch: () => Promise<void>
}

function provideComicContext(source: ComicDataSource): ComicContext {
  const context: ComicContext = {
    comic: computed(() => source.data.value?.comic ?? null),
    chapters: computed(() => source.data.value?.chapters ?? []),
    notes: computed(() => source.data.value?.notes ?? []),
    tags: computed(() => source.data.value?.tags ?? []),
    characters: computed(() => source.data.value?.characters ?? []),
    persons: computed(() => source.data.value?.persons ?? []),
    companies: computed(() => source.data.value?.companies ?? []),
    relations: computed(() => source.data.value?.relations ?? []),
    sessions: computed(() => source.data.value?.sessions ?? []),
    isLoading: source.isLoading,
    isFetching: source.isFetching,
    error: source.error,
    refetch: source.refetch
  }

  provide(ComicKey, context)

  return context
}

const COMIC_OWNED_TABLES = [
  'comic_chapters',
  'comic_chapter_files',
  'comic_notes',
  'comic_sessions',
  'comic_tag_links',
  'comic_character_links',
  'comic_person_links',
  'comic_company_links',
  'media_relations'
]

function useComicDbSync(comicId: MaybeRefOrGetter<string>, refetch: () => Promise<void>): void {
  useDbChanges(({ operation, table, id: entityId }) => {
    if (COMIC_OWNED_TABLES.includes(table)) {
      refetch()
      return
    }
    if (table === 'comics' && entityId === toValue(comicId) && operation !== 'inserted') {
      refetch()
    }
  })
}

// =============================================================================
// Provider Composables
// =============================================================================

/**
 * Provide comic data on the route surface.
 *
 * Data is loaded by `comicDetailData` during navigation, so it is already
 * settled when the page mounts. In-page input changes (spoilers, NSFW
 * preference) trigger a non-blocking SWR refetch.
 */
export function useComicRouteProvider(): ComicProviderReturn {
  const route = useRoute()
  const comicId = computed(() => route.params.comicId as string)
  const { data, error, isFetching, refetch } = comicDetailData()

  const { showNsfw } = storeToRefs(usePreferencesStore())
  watch(showNsfw, () => void refetch())

  // Explicit setter (not a watcher on the module ref) so the loader's
  // cross-navigation spoiler reset does not trigger a duplicate fetch.
  const spoilersRevealed = computed({
    get: () => routeSpoilersRevealed.value,
    set: (value) => {
      routeSpoilersRevealed.value = value
      void refetch()
    }
  })

  const context = provideComicContext({
    data,
    isLoading: ref(false),
    isFetching,
    error,
    refetch
  })
  useComicDbSync(comicId, refetch)

  return { ...context, spoilersRevealed }
}

/**
 * Provide comic data on the dialog surface (fetches after mount).
 *
 * Spoiler state is instance-local and resets when the dialog unmounts.
 */
export function useComicDialogProvider(comicId: MaybeRefOrGetter<string>): ComicProviderReturn {
  const id = toRef(comicId)
  const spoilersRevealed = ref(false)
  const { showNsfw } = storeToRefs(usePreferencesStore())

  const { data, isLoading, isFetching, error, refetch } = useAsyncData(
    () => fetchComicData(toValue(id), spoilersRevealed.value, showNsfw.value),
    { watch: [id, spoilersRevealed, showNsfw] }
  )

  const context = provideComicContext({ data, isLoading, isFetching, error, refetch })
  useComicDbSync(id, refetch)

  return { ...context, spoilersRevealed }
}

// =============================================================================
// Consumer Composable
// =============================================================================

/**
 * Consume comic data context
 *
 * Call this in child components to access comic data.
 */
export function useComic(): ComicContext {
  const context = inject(ComicKey)
  if (!context) {
    throw new Error('useComic() must be used within a component that provided the comic context')
  }
  return context
}
