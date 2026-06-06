import type { VniteAttachmentPathResolver } from '../mapping'
import type { VniteImportFieldSelection } from './options'
import type { VniteGraphBuildAccumulator } from './accumulator'

export interface VniteGraphBuildContext {
  graph: VniteGraphBuildAccumulator
  selection: VniteImportFieldSelection
  resolveAttachmentPath?: VniteAttachmentPathResolver
}
