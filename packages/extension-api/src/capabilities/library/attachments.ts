import type { LibraryEntityReference } from './entities'

export const LIBRARY_ATTACHMENT_KINDS = [
  'cover',
  'backdrop',
  'logo',
  'icon',
  'photo',
  'description-inline',
  'content-inline',
  'file'
] as const

export type LibraryAttachmentKind = (typeof LIBRARY_ATTACHMENT_KINDS)[number]

export type LibraryAttachmentOwnerType =
  'game' | 'anime' | 'comic' | 'novel' | 'character' | 'person' | 'company' | 'collection'

export type LibraryAttachmentSource =
  | {
      kind: 'buffer'
      buffer: Uint8Array
      fileName?: string
      contentType?: string
    }
  | {
      kind: 'url'
      url: string
      fileName?: string
    }
  | {
      kind: 'path'
      path: string
    }

export interface LibraryAttachment {
  entity: LibraryEntityReference<LibraryAttachmentOwnerType>
  slot: LibraryAttachmentKind
  fileName: string
  filePath: string
  contentType?: string
  sizeBytes?: number
  createdAt?: number
}

export interface LibraryAttachmentWriteInput {
  entity: LibraryEntityReference<LibraryAttachmentOwnerType>
  slot: LibraryAttachmentKind
  source: LibraryAttachmentSource
  replace?: boolean
}

export interface LibraryAttachmentRemoveInput {
  entity: LibraryEntityReference<LibraryAttachmentOwnerType>
  slot: LibraryAttachmentKind
  fileName?: string
}

export interface LibraryAttachmentCapability {
  list(
    entity: LibraryEntityReference<LibraryAttachmentOwnerType>
  ): Promise<readonly LibraryAttachment[]>
  put(input: LibraryAttachmentWriteInput): Promise<LibraryAttachment>
  remove(input: LibraryAttachmentRemoveInput): Promise<void>
}
