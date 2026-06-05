export interface FilePickerFilter {
  name: string
  extensions: readonly string[]
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
}
