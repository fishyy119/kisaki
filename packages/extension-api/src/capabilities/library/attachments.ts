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
      fileName?: string | undefined
      contentType?: string | undefined
    }
  | {
      kind: 'url'
      url: string
      fileName?: string | undefined
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
  contentType?: string | undefined
  sizeBytes?: number | undefined
  createdAt?: number | undefined
}

export interface LibraryAttachmentWriteInput {
  entity: LibraryEntityReference<LibraryAttachmentOwnerType>
  slot: LibraryAttachmentKind
  source: LibraryAttachmentSource
  replace?: boolean | undefined
}

export interface LibraryAttachmentRemoveInput {
  entity: LibraryEntityReference<LibraryAttachmentOwnerType>
  slot: LibraryAttachmentKind
  fileName?: string | undefined
}

export interface LibraryAttachmentCapability {
  list(
    entity: LibraryEntityReference<LibraryAttachmentOwnerType>
  ): Promise<readonly LibraryAttachment[]>
  put(input: LibraryAttachmentWriteInput): Promise<LibraryAttachment>
  remove(input: LibraryAttachmentRemoveInput): Promise<void>
}
