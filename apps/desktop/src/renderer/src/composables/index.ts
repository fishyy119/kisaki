// Composables re-exports

// Content entity aggregates
export {
  createEmptyContentEntityCounts,
  type ContentEntityCounts,
  type ContentEntityData
} from './content-entities'

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
export { useDbChanges } from './use-db-changes'
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
  type EntityDetailContext,
  type EntityDetailProviderReturn,
  type EntityDetailSpec,
  type EntityDetailView
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
export { useAnimeFileSync, type AnimeFileSync } from './use-anime-file-sync'
export {
  markEpisodesWatched,
  readUnwatchedEpisodeCounts,
  shouldOfferWatchCatchUp,
  toggleEpisodeWatched,
  useAnimeWatch,
  type AnimeWatch,
  type UnwatchedEpisodeCounts
} from './use-anime-watch'
export {
  comicDetailData,
  useComic,
  useComicDialogProvider,
  useComicRouteProvider,
  type ComicChapterEntry,
  type ComicContext,
  type ComicProviderReturn
} from './use-comic'
export { useComicFileSync, type ComicFileSync } from './use-comic-file-sync'
export { useComicReading, type ComicReading } from './use-comic-reading'
export {
  novelDetailData,
  useNovel,
  useNovelDialogProvider,
  useNovelRouteProvider,
  type NovelContext,
  type NovelProviderReturn,
  type NovelVolumeEntry
} from './use-novel'
export { useNovelFileSync, type NovelFileSync } from './use-novel-file-sync'
export { useNovelReading, type NovelReading } from './use-novel-reading'
export { useReaderChrome, type ReaderChrome, type ReaderPanelTab } from './use-reader-chrome'
export { useReadingClock } from './use-reading-clock'
export {
  CollectionKey,
  collectionDetailData,
  useCollection,
  useCollectionDialogProvider,
  useCollectionRouteProvider,
  type CollectionContext
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
  TagKey,
  tagDetailData,
  useTag,
  useTagDialogProvider,
  useTagRouteProvider,
  type TagContext
} from './use-tag'
