// Game shared components re-exports

// Core components
export { default as GameCard } from './game-card.vue'
export { default as GamePlayButton } from './game-play-button.vue'
export { default as GameSearcher } from './game-searcher.vue'
export { default as GameSelect } from './game-select.vue'

// Forms
export { GameInfoFormDialog, GameLaunchConfigFormDialog, GameSavesFormDialog } from './forms'

// Detail
export {
  GameDetailContent,
  GameDetailHero,
  GameDetailDialog,
  GameDetailOverviewTab,
  GameDetailCharactersTab,
  GameDetailPersonsTab,
  GameDetailCompaniesTab,
  GameDetailSavesTab,
  GameDetailNotesTab,
  GameDetailActivityTab
} from './detail'
