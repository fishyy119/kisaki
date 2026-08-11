// Anime shared components re-exports

export { default as AnimeCard } from './anime-card.vue'
export { default as AnimeSearcher } from './anime-searcher.vue'
export { default as AnimeSelect } from './anime-select.vue'
export { default as AnimeWatchButton } from './anime-watch-button.vue'
export { AnimeDetailContent, AnimeDetailDialog, AnimeDetailHero } from './detail'
export {
  AnimeScoreFormDialog,
  AnimeNameFormDialog,
  AnimeOriginalNameFormDialog,
  AnimeInfoFormDialog,
  AnimeDescriptionFormDialog,
  AnimeDeleteFormDialog,
  AnimeBatchDeleteFormDialog,
  AnimeMetadataUpdateFormDialog,
  AnimeBatchMetadataUpdateFormDialog
} from './forms'
export {
  AnimeContextMenu,
  AnimeMenuItems,
  AnimeDropdownMenu,
  AnimeBatchContextMenu,
  AnimeBatchMenuItems
} from './menus'
export type { AnimeSearcherSelection } from './types'
