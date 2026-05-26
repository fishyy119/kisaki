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
  RawDbChangeEvent,
  ScannerCreatedEvent,
  ScannerDeletedEvent,
  ScannerFinishedEvent,
  ScannerUpdatedEvent
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

  'db.ready': [boolean]
  'db.inserted': [RawDbChangeEvent]
  'db.updated': [RawDbChangeEvent]
  'db.deleted': [RawDbChangeEvent]

  // Typed domain entity events
  'game.created': [LibraryGameCreatedEvent]
  'game.updated': [LibraryGameUpdatedEvent]
  'game.deleted': [LibraryGameDeletedEvent]
  'game.started': [{ gameId: string; pid?: number }]
  'game.stopped': [{ gameId: string; playTime?: number }]
  'person.created': [LibraryPersonCreatedEvent]
  'person.updated': [LibraryPersonUpdatedEvent]
  'person.deleted': [LibraryPersonDeletedEvent]
  'company.created': [LibraryCompanyCreatedEvent]
  'company.updated': [LibraryCompanyUpdatedEvent]
  'company.deleted': [LibraryCompanyDeletedEvent]
  'character.created': [LibraryCharacterCreatedEvent]
  'character.updated': [LibraryCharacterUpdatedEvent]
  'character.deleted': [LibraryCharacterDeletedEvent]
  'collection.created': [LibraryCollectionCreatedEvent]
  'collection.updated': [LibraryCollectionUpdatedEvent]
  'collection.deleted': [LibraryCollectionDeletedEvent]
  'tag.created': [LibraryTagCreatedEvent]
  'tag.updated': [LibraryTagUpdatedEvent]
  'tag.deleted': [LibraryTagDeletedEvent]
  'scanner.created': [ScannerCreatedEvent]
  'scanner.updated': [ScannerUpdatedEvent]
  'scanner.deleted': [ScannerDeletedEvent]
  'entity.merged': [LibraryEntityMergedEvent]

  // =========================================================================
  // Runtime Events
  // =========================================================================

  'scanner.started': [{ scannerId: string; scannerName: string }]
  'scanner.finished': [ScannerFinishedEvent]

  // Command events
  'command.started': [CommandExecutionStartResult]
  'command.progressed': [CommandExecutionProgress]
  'command.finished': [CommandExecutionResult]

  // Background task events
  'backgroundTask.changed': [{ taskId: string }]
  'backgroundTask.deleted': [{ taskId: string }]
  'backgroundTask.started': [
    {
      taskId: string
      commandId: string
      trigger: BackgroundTaskRunRecord['trigger']
      startedAt: number
    }
  ]
  'backgroundTask.finished': [BackgroundTaskRunRecord]

  // Application events
  'app.ready': []
  'app.theme.changed': [{ theme: 'light' | 'dark' | 'system' }]
  'app.locale.changed': [{ locale: AppLocale | null }]
  'app.settings.changed': [{ setting: string; value: unknown }]

  // Extension lifecycle events
  'extension.enabled': [{ extensionId: string }]
  'extension.disabled': [{ extensionId: string }]
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
