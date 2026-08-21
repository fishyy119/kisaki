import type {
  LibraryGraphDiagnostic,
  LibraryGraphResultAction,
  LibraryMediaType
} from '@kisaki3/extension-api'
import type { DbService } from '@main/services/db'
import type { ExtensionLibraryAttachmentStore } from '../../attachments'
import type { ExtensionLibraryEntityStore, ExtensionLibraryEpisodeStore } from '../../entities'

export interface ExecuteLibraryGraphOptions {
  db: DbService
  entities: ExtensionLibraryEntityStore
  episodes: ExtensionLibraryEpisodeStore
  attachments: ExtensionLibraryAttachmentStore
}

export interface ApplyState {
  entityIds: Map<string, string>
  /** Media node key to media type, so edges can pick the per-media link table. */
  mediaTypes: Map<string, LibraryMediaType>
  failedNodes: Set<string>
  skippedMedia: Set<string>
  noteOwners: Map<string, string>
  sessionOwners: Map<string, string>
  episodeOwners: Map<string, string>
  attachmentActions: Map<string, LibraryGraphResultAction>
  attachmentDiagnostics: Map<string, LibraryGraphDiagnostic[]>
}
