/**
 * Service Layer Types
 *
 * Defines the core interfaces for the service layer architecture.
 */

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
import type { VideoService } from '@main/services/video/service'
import type { HoldingsService } from '@main/services/holdings/service'
import type { ImageService } from '@main/services/image/service'
import type { ReaderService } from '@main/services/reader/service'
import type { ActivityService } from '@main/services/activity/service'
import type { AttachmentService } from '@main/services/attachment/service'
import type { ExtensionService } from '@main/services/extension/service'
import type { NetworkService } from '@main/services/network/service'
import type { NotificationService } from '@main/services/notification/service'
import type { DeeplinkService } from '@main/services/deeplink/service'
import type { UpdaterService } from '@main/services/updater/service'
import type { CommandService } from '@main/services/command/service'
import type { AutomationService } from '@main/services/automation/service'
import type { TaskRunService } from '@main/services/task-run/service'

/**
 * Service Registry - Centralized type mapping for all core services.
 * Used by ServiceContainer.get() for type-safe service retrieval.
 *
 * Grouped by layer. The layer is a property of a service, not a location:
 * `services/` stays flat so a service id maps to exactly one directory, and the
 * one hard rule — non-domain services never depend on domain services — is
 * enforced by `INonDomainService` below rather than by any folder.
 * See `.agents/skills/kisaki/references/architecture.md`.
 */
export interface ServiceRegistry {
  // Platform: Electron, OS, and transport adapters
  ipc: IpcService
  db: DbService
  window: WindowService
  native: NativeService
  notification: NotificationService
  network: NetworkService
  deeplink: DeeplinkService
  updater: UpdaterService
  i18n: I18nService

  // Capability: no domain vocabulary, no library rows
  'task-run': TaskRunService
  'file-watch': FileWatchService
  process: ProcessService
  video: VideoService
  reader: ReaderService
  image: ImageService

  // Domain: library ownership, grows per media type
  scraper: ScraperService
  ingest: IngestService
  scanner: ScannerService
  holdings: HoldingsService
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
 * Services that own library meaning: entity rows, media workflows, and the
 * vocabulary of the collection.
 */
export type DomainServiceName =
  | 'scraper'
  | 'ingest'
  | 'scanner'
  | 'holdings'
  | 'activity'
  | 'attachment'
  | 'command'
  | 'automation'
  | 'extension'

/** Platform and capability services: no library meaning of their own. */
export type NonDomainServiceName = Exclude<ServiceName, DomainServiceName>

/**
 * The layering red line, as a type.
 *
 * A platform or capability service may depend on other non-domain services, but
 * never on a domain service — otherwise the "technical layer knows nothing about
 * the library" claim is only a comment. Declaring a domain dep on one of these
 * services fails to compile; the fix is to invert the dependency (let the domain
 * service register itself with the platform one) rather than widen this type.
 */
export interface INonDomainService<
  K extends NonDomainServiceName = NonDomainServiceName
> extends IService<K> {
  readonly deps: readonly NonDomainServiceName[]
}

/**
 * Get service type by name
 */
export type ServiceType<K extends ServiceName> = ServiceRegistry[K]

// =============================================================================

/**
 * Scoped container view.
 *
 * Narrows what a service can reach to the services it declared in `deps`, so a
 * missing declaration is a compile error rather than an init-order surprise.
 */
export interface ScopedContainer<Allowed extends ServiceName> {
  get<K extends Allowed>(name: K): ServiceType<K>
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
