/**
 * Service Layer Types
 *
 * Defines the core interfaces for the service layer architecture.
 */

import type { ContentEntityType, MediaType } from '@shared/common'

/**
 * Service initialization status
 */
export type ServiceStatus =
  'registered' | 'initializing' | 'ready' | 'failed' | 'disposing' | 'disposed'

// =============================================================================
// Import all service types for centralized registry
// =============================================================================

// NOTE: These are type-only imports (no runtime dependency).
import type { DbService } from '@main/services/db/service'
import type { FileWatchService } from '@main/services/file-watch/service'
import type { IpcService } from '@main/services/ipc/service'
import type { WindowService } from '@main/services/window/service'
import type { NativeService } from '@main/services/native/service'
import type { I18nService } from '@main/services/i18n/service'
import type { ScraperService } from '@main/services/scraper/service'
import type { IngestService } from '@main/services/ingest/service'
import type { ScannerService } from '@main/services/scanner/service'
import type { ProcessService } from '@main/services/process/service'
import type { PlayerService } from '@main/services/player/service'
import type { MediaFilesService } from '@main/services/media-files/service'
import type { MediaInfoService } from '@main/services/media-info/service'
import type { ReaderService } from '@main/services/reader/service'
import type { ActivityService } from '@main/services/activity/service'
import type { AttachmentService } from '@main/services/attachment/service'
import type { ExtensionService } from '@main/services/extension/service'
import type { NetworkService } from '@main/services/network/service'
import type { NotifyService } from '@main/services/notify/service'
import type { DeeplinkService } from '@main/services/deeplink/service'
import type { UpdaterService } from '@main/services/updater/service'
import type { CommandService } from '@main/services/command/service'
import type { AutomationService } from '@main/services/automation/service'
import type { TaskRunService } from '@main/services/task-run/service'

/**
 * Service Registry - Centralized type mapping for all core services.
 * Used by ServiceContainer.get() for type-safe service retrieval.
 *
 * Grouped by layer. The layer is a property of a service, not a location: it is
 * enforced by `deps`, which is why capability services declare no domain
 * dependency. See `.agents/skills/kisaki/references/architecture.md`.
 */
export interface ServiceRegistry {
  // Platform: Electron, OS, and transport adapters
  ipc: IpcService
  db: DbService
  window: WindowService
  native: NativeService
  notify: NotifyService
  network: NetworkService
  deeplink: DeeplinkService
  updater: UpdaterService
  i18n: I18nService

  // Capability: no domain vocabulary, no library rows
  'task-run': TaskRunService
  'file-watch': FileWatchService
  'media-info': MediaInfoService
  process: ProcessService
  player: PlayerService

  // Domain: library ownership, grows per media type
  scraper: ScraperService
  ingest: IngestService
  scanner: ScannerService
  'media-files': MediaFilesService
  reader: ReaderService
  activity: ActivityService
  attachment: AttachmentService
  command: CommandService
  automation: AutomationService
  extension: ExtensionService
}

/**
 * All registered service names
 */
export type ServiceName = keyof ServiceRegistry

/**
 * Get service type by name
 */
export type ServiceType<K extends ServiceName> = ServiceRegistry[K]

// =============================================================================

/**
 * Scoped container view.
 *
 * Exposes only dependency-safe accessors (no escape-hatch overloads like get<T>(string)).
 * Used to restrict what a service can access based on its declared deps.
 */
export interface ScopedContainer<Allowed extends ServiceName> {
  get<K extends Allowed>(name: K): ServiceType<K>
  tryGet<K extends Allowed>(name: K): ServiceType<K> | undefined
}

/**
 * Helper to derive the init container type from a service's declared deps.
 */
export type ServiceInitContainer<T extends { deps: readonly ServiceName[] }> = ScopedContainer<
  T['deps'][number]
>

/**
 * Base interface for all services
 */
export interface IService<K extends ServiceName = ServiceName> {
  /** Unique service identifier */
  readonly id: K

  /**
   * Explicit dependencies.
   * The container guarantees deps are ready before calling init().
   */
  readonly deps: readonly ServiceName[]

  /**
   * Initialize the service.
   * Called during container.initAll().
   */
  init(container: ScopedContainer<this['deps'][number]>): Promise<void>

  /**
   * Dispose the service and release resources.
   * Called in reverse registration order during shutdown.
   */
  dispose?(): Promise<void>
}

/**
 * Interface for services that support multiple media types.
 * Extend this when a service has media-specific handlers.
 */
export interface IMediaService extends IService {
  /**
   * Get the media types this service currently supports.
   */
  getSupportedMedia(): MediaType[]
}

/**
 * Interface for services that operate on content entities.
 */
export interface IContentService extends IService {
  /**
   * Get the content entity types this service currently supports.
   */
  getSupportedContent(): ContentEntityType[]
}
