/**
 * Cross-process event type definitions
 *
 * Defines all application events that can be emitted in either main or renderer process.
 *
 * Defines application-owned events shared between main and renderer.
 */

import type { AppLocale } from '../locale'
import type { BackgroundTaskRunRecord } from '../background-task'
import type {
  CommandExecutionProgress,
  CommandExecutionResult,
  CommandExecutionStartResult
} from '../command'
import type {
  LibraryCharacterCreatedEvent,
  LibraryCharacterDeletedEvent,
  LibraryCharacterUpdatedEvent,
  LibraryCollectionCreatedEvent,
  LibraryCollectionDeletedEvent,
  LibraryCollectionUpdatedEvent,
  LibraryCompanyCreatedEvent,
  LibraryCompanyDeletedEvent,
  LibraryCompanyUpdatedEvent,
  LibraryEntityMergedEvent,
  LibraryGameCreatedEvent,
  LibraryGameDeletedEvent,
  LibraryGameUpdatedEvent,
  LibraryPersonCreatedEvent,
  LibraryPersonDeletedEvent,
  LibraryPersonUpdatedEvent,
  LibraryTagCreatedEvent,
  LibraryTagDeletedEvent,
  LibraryTagUpdatedEvent,
  RawDbChangeEvent
} from './library'

// =============================================================================
// Application Events
// =============================================================================

/**
 * Application event definitions
 *
 * This interface is exported and can be extended via declaration merging.
 * Each event maps to a tuple of its argument types.
 */
export interface AppEvents {
  // =========================================================================
  // Database Events
  // =========================================================================

  'db:ready': [boolean]
  'db:inserted': [RawDbChangeEvent]
  'db:updated': [RawDbChangeEvent]
  'db:deleted': [RawDbChangeEvent]

  // Typed library domain events
  'library.game.created': [LibraryGameCreatedEvent]
  'library.game.updated': [LibraryGameUpdatedEvent]
  'library.game.deleted': [LibraryGameDeletedEvent]
  'library.person.created': [LibraryPersonCreatedEvent]
  'library.person.updated': [LibraryPersonUpdatedEvent]
  'library.person.deleted': [LibraryPersonDeletedEvent]
  'library.company.created': [LibraryCompanyCreatedEvent]
  'library.company.updated': [LibraryCompanyUpdatedEvent]
  'library.company.deleted': [LibraryCompanyDeletedEvent]
  'library.character.created': [LibraryCharacterCreatedEvent]
  'library.character.updated': [LibraryCharacterUpdatedEvent]
  'library.character.deleted': [LibraryCharacterDeletedEvent]
  'library.collection.created': [LibraryCollectionCreatedEvent]
  'library.collection.updated': [LibraryCollectionUpdatedEvent]
  'library.collection.deleted': [LibraryCollectionDeletedEvent]
  'library.tag.created': [LibraryTagCreatedEvent]
  'library.tag.updated': [LibraryTagUpdatedEvent]
  'library.tag.deleted': [LibraryTagDeletedEvent]
  'library.entity.merged': [LibraryEntityMergedEvent]

  // =========================================================================
  // Entity Events
  // =========================================================================

  // Game events
  'game:added': [{ gameId: string; name: string }]
  'game:removed': [{ gameId: string }]
  'game:updated': [{ gameId: string; fields: string[] }]
  'game:launched': [{ gameId: string; pid?: number }]
  'game:closed': [{ gameId: string; playTime?: number }]

  // Collection events
  'collection:added': [{ collectionId: string; name: string }]
  'collection:removed': [{ collectionId: string }]
  'collection:updated': [{ collectionId: string; fields: string[] }]

  // Character events
  'character:added': [{ characterId: string; name: string }]
  'character:removed': [{ characterId: string }]
  'character:updated': [{ characterId: string; fields: string[] }]

  // Person events
  'person:added': [{ personId: string; name: string }]
  'person:removed': [{ personId: string }]
  'person:updated': [{ personId: string; fields: string[] }]

  // Company events
  'company:added': [{ companyId: string; name: string }]
  'company:removed': [{ companyId: string }]
  'company:updated': [{ companyId: string; fields: string[] }]

  // Scanner events
  'scanner:added': [{ scannerId: string; name: string }]
  'scanner:removed': [{ scannerId: string }]
  'scanner:updated': [{ scannerId: string; fields: string[] }]
  'scanner:started': [{ scannerId: string; scannerName: string }]
  'scanner:progress': [{ scannerId: string; current: number; total: number }]
  'scanner:completed': [{ scannerId: string; stats: Record<string, number> }]
  'scanner:error': [{ scannerId: string; error: string }]

  // Command events
  'command:started': [CommandExecutionStartResult]
  'command:progress': [CommandExecutionProgress]
  'command:finished': [CommandExecutionResult]

  // Background task events
  'background-task:changed': [{ taskId: string }]
  'background-task:deleted': [{ taskId: string }]
  'background-task:run-started': [
    {
      taskId: string
      commandId: string
      trigger: BackgroundTaskRunRecord['trigger']
      startedAt: number
    }
  ]
  'background-task:run-finished': [BackgroundTaskRunRecord]

  // Monitor events
  'monitor:status-changed': [{ gameId: string; isRunning: boolean; isForeground: boolean }]
  'monitor:process-started': [{ gameId: string; pid: number; processName: string }]
  'monitor:process-stopped': [{ gameId: string; exitCode?: number }]
  'monitor:foreground-changed': [{ gameId: string; isForeground: boolean }]

  // Scraper profile events
  'scraper:fetch-started': [{ profileId: string; identifier: string }]
  'scraper:fetch-completed': [{ profileId: string; identifier: string; success: boolean }]
  'scraper:fetch-error': [{ profileId: string; identifier: string; error: string }]

  // Application events
  'app:ready': []
  'app:theme-changed': [{ theme: 'light' | 'dark' | 'system' }]
  'app:locale-changed': [{ locale: AppLocale | null }]
  'app:settings-changed': [{ setting: string; value: unknown }]
  'app:portable-mode-change-pending': [{ targetMode: 'portable' | 'normal' }]
  'app:portable-mode-change-cancelled': []

  // Extension lifecycle events
  'extension:enabled': [{ extensionId: string }]
  'extension:disabled': [{ extensionId: string }]
}

// =============================================================================
// Event Helper Types
// =============================================================================

/**
 * Event listener function type
 */
export type AppEventListener<K extends keyof AppEvents> = (
  ...args: AppEvents[K]
) => void | Promise<void>

/**
 * Event unsubscribe function
 */
export type EventUnsubscribe = () => void

/**
 * Event emitter options
 */
export interface EventEmitOptions {
  local?: boolean
}
