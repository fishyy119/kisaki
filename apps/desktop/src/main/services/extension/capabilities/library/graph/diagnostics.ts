import type {
  LibraryGraphDiagnostic,
  LibraryGraphDiagnosticLevel,
  LibraryGraphEdge
} from '@kisaki3/extension-api'

export interface GraphDiagnosticInput {
  level: LibraryGraphDiagnosticLevel
  code: string
  message: string
  nodeKey?: string
  edgeKind?: LibraryGraphEdge['kind']
}

export function createDiagnostic(input: GraphDiagnosticInput): LibraryGraphDiagnostic {
  return {
    level: input.level,
    code: input.code,
    message: input.message,
    nodeKey: input.nodeKey,
    edgeKind: input.edgeKind
  }
}

export function createAttachmentPersistDiagnostic(
  error: unknown,
  nodeKey: string
): LibraryGraphDiagnostic {
  const message =
    error instanceof Error && error.message ? error.message : 'Attachment could not be saved.'
  return createDiagnostic({
    level: 'warning',
    code: 'kisaki.graph.attachmentPersistFailed',
    message,
    nodeKey
  })
}
