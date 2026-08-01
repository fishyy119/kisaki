export interface FilePickerFilter {
  name: string
  extensions: readonly string[]
}

export type FileIconSize = 'small' | 'normal' | 'large'

export interface GetFileIconInput {
  size?: FileIconSize
}

export interface PickFileInput {
  title?: string
  filters?: readonly FilePickerFilter[]
  copyTo?: 'temp' | 'data'
  maxSizeBytes?: number
}

export interface ExtensionFileGrant {
  grantId: string
  name: string
  extension: string
  sizeBytes: number
  path: string
  originalPathLabel: string
  createdAt: number
}

export interface FilesCapability {
  pickFile(input?: PickFileInput): Promise<ExtensionFileGrant | null>
  releaseGrant(grantId: string): Promise<void>
  /**
   * Reads the OS-rendered icon of a file as PNG bytes.
   * @remarks Unlike {@link pickFile}, this is a direct read-only lookup with no
   * user mediation and no grant lifecycle. Returns `null` when the OS reports
   * no icon for the path.
   */
  getFileIcon(path: string, input?: GetFileIconInput): Promise<Uint8Array | null>
}
