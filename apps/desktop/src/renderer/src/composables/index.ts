// Composables re-exports

// Content entity aggregates
export {
  createEmptyContentEntityCounts,
  type ContentEntityCounts,
  type ContentEntityData
} from './content-entities'
export {
  clearEntityListQuery,
  createEntityListQuery,
  hasActiveEntityListQuery,
  resolveEntityListType,
  switchEntityListType,
  type EntityListQuery,
  type OrganizerDetailParams
} from './entity-list-query'

// Core composables
export { useAmbientLight } from './use-ambient-light'
export { useAsyncData, type UseAsyncDataOptions, type UseAsyncDataReturn } from './use-async-data'
export { useDebouncedRef } from './use-debounced-ref'
export {
  LOADING_PRESETS,
  useDelayedLoading,
  type DelayedLoadingOptions,
  type LoadingPreset,
  type UseDelayedLoadingReturn
} from './use-delayed-loading'
export { useEntityDelete } from './use-entity-delete'
export { useEntityDetailRoute } from './use-entity-detail-route'
export { useEntityMerge } from './use-entity-merge'
export { useEntitySelectSource } from './use-entity-select-source'
export { batchTouchesAny, useDbChanges, type DbChangeBatch } from './use-db-changes'
export { useIpc, useIpcOnce } from './use-ipc'
export { useI18n } from './use-i18n'
export { useRenderState, type RenderState, type UseRenderStateOptions } from './use-render-state'
export { useInlineAttachments, type UseInlineAttachmentsOptions } from './use-inline-attachments'
export { usePlayerControls, type PlayerControls } from './use-player-controls'
export {
  useStagedImagePick,
  type StagedImageMode,
  type StagedImagePick
} from './use-staged-image-pick'

// Entity data composables (Provider/Consumer pattern)
export {
  createEntityDetailContext,
  createEntitySpoilerParams,
  type EntityDetailContext,
  type EntityDetailParams,
  type EntityDetailProviderReturn,
  type EntityDetailSpec,
  type EntityDetailView,
  type EntitySpoilerParams
} from './entity-context'
export {
  gameDetailData,
  useGame,
  useGameDialogProvider,
  useGameRouteProvider,
  type GameCastEntry,
  type GameContext,
  type GameProviderReturn
} from './use-game'
export {
  animeDetailData,
  useAnime,
  useAnimeDialogProvider,
  useAnimeRouteProvider,
  type AnimeCastEntry,
  type AnimeContext,
  type AnimeEpisodeEntry,
  type AnimeExtraEntry,
  type AnimeProviderReturn
} from './use-anime'
export { useAnimeExtraPlayback, type AnimeExtraPlayback } from './use-anime-extra-playback'
export {
  useAnimeFileRecords,
  type AnimeFileRecords,
  type AnimeFileRecordsOptions
} from './use-anime-file-records'
export { useAnimeFileSync } from './use-anime-file-sync'
export {
  markEpisodesWatched,
  readUnwatchedEpisodeCounts,
  shouldOfferWatchCatchUp,
  toggleEpisodeWatched,
  type UnwatchedEpisodeCounts
} from './anime-completion'
export { useAnimeWatching, type AnimeWatching } from './use-anime-watching'
export {
  comicDetailData,
  useComic,
  useComicDialogProvider,
  useComicRouteProvider,
  type ComicChapterEntry,
  type ComicContext,
  type ComicProviderReturn
} from './use-comic'
export { useComicFileSync } from './use-comic-file-sync'
export { useComicReading, type ComicReading } from './use-comic-reading'
export {
  markChaptersRead,
  readUnreadChapterCount,
  shouldOfferReadCatchUp as shouldOfferComicReadCatchUp,
  toggleChapterRead
} from './comic-completion'
export {
  novelDetailData,
  useNovel,
  useNovelDialogProvider,
  useNovelRouteProvider,
  type NovelContext,
  type NovelProviderReturn,
  type NovelVolumeEntry
} from './use-novel'
export { useNovelFileSync } from './use-novel-file-sync'
export { useNovelReading, type NovelReading } from './use-novel-reading'
export {
  markVolumesRead,
  readUnreadVolumeCount,
  shouldOfferReadCatchUp as shouldOfferNovelReadCatchUp,
  toggleVolumeRead
} from './novel-completion'
export { useReaderChrome, type ReaderChrome, type ReaderPanelTab } from './use-reader-chrome'
export { useReadingClock } from './use-reading-clock'
export {
  collectionDetailData,
  useCollection,
  useCollectionDialogProvider,
  useCollectionRouteProvider,
  type CollectionContext,
  type CollectionProviderReturn
} from './use-collection'
export {
  personDetailData,
  usePerson,
  usePersonDialogProvider,
  usePersonRouteProvider,
  type PersonCastEntry,
  type PersonContext,
  type PersonProviderReturn
} from './use-person'
export {
  characterDetailData,
  useCharacter,
  useCharacterDialogProvider,
  useCharacterRouteProvider,
  type CharacterCastEntry,
  type CharacterContext,
  type CharacterProviderReturn
} from './use-character'
export {
  companyDetailData,
  useCompany,
  useCompanyDialogProvider,
  useCompanyRouteProvider,
  type CompanyContext,
  type CompanyProviderReturn,
  type CompanyRelationEntry
} from './use-company'
export {
  tagDetailData,
  useTag,
  useTagDialogProvider,
  useTagRouteProvider,
  type TagContext,
  type TagProviderReturn
} from './use-tag'
