import type { LibraryGraphDiagnostic, LibraryGraphResultAction } from '@kisaki3/extension-api'
import type { DbService } from '@main/services/db'
import type { ExtensionLibraryAttachmentStore } from '../../attachments'
import type { ExtensionLibraryEntityStore } from '../../entities'

export interface ExecuteLibraryGraphOptions {
  db: DbService
  entities: ExtensionLibraryEntityStore
  attachments: ExtensionLibraryAttachmentStore
}

export interface ApplyState {
  entityIds: Map<string, string>
  skippedMedia: Set<string>
  noteOwners: Map<string, string>
  sessionOwners: Map<string, string>
  attachmentActions: Map<string, LibraryGraphResultAction>
  attachmentDiagnostics: Map<string, LibraryGraphDiagnostic[]>
}
