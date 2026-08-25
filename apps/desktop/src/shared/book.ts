/**
 * Book container and content protocol contracts.
 *
 * A reading container is told apart by what the engine must do with it: paged
 * containers are addressed page by page, document containers are handed to an
 * engine that parses them whole. The `book://` scheme streams either out of
 * unit file rows — comic pages by index, whole book files for engines that
 * parse the container themselves. URLs reference database file-row ids, never
 * raw paths, so the handler resolves and confines every request to a row the
 * library owns.
 */

export const BOOK_SCHEME = 'book'

/** One page image of a comic unit file (zip/rar/directory containers). */
export function buildComicPageUrl(fileId: string, pageIndex: number): string {
  return `${BOOK_SCHEME}://comic-page/${encodeURIComponent(fileId)}/${pageIndex}`
}

/** The whole bytes of a comic unit file (PDF rendering reads the file itself). */
export function buildComicFileUrl(fileId: string): string {
  return `${BOOK_SCHEME}://comic-file/${encodeURIComponent(fileId)}`
}

/** The whole bytes of a novel volume file; text engines parse the container. */
export function buildNovelFileUrl(fileId: string): string {
  return `${BOOK_SCHEME}://novel-file/${encodeURIComponent(fileId)}`
}

// =============================================================================
// Containers
// =============================================================================

/** A container addressable page by page, as probed. */
export type PagedContainer = 'zip' | 'rar' | 'directory' | 'pdf'

const PAGED_CONTAINERS: readonly PagedContainer[] = ['zip', 'rar', 'directory', 'pdf']

/** Technical facts read from one paged container. */
export interface PagedContainerInfo {
  container: PagedContainer
  /** Readable page count; null when the container probe could not answer. */
  pageCount: number | null
}

/** A container holding one document, told by its extension. */
export type DocumentContainer = 'epub' | 'mobi' | 'azw3' | 'fb2' | 'txt' | 'pdf'

const DOCUMENT_CONTAINERS: readonly DocumentContainer[] = [
  'epub',
  'mobi',
  'azw3',
  'fb2',
  'txt',
  'pdf'
]

/** Extensions that name a document container, including format aliases. */
const DOCUMENT_CONTAINER_BY_EXTENSION: Record<string, DocumentContainer> = {
  epub: 'epub',
  mobi: 'mobi',
  azw3: 'azw3',
  azw: 'azw3',
  fb2: 'fb2',
  txt: 'txt',
  pdf: 'pdf'
}

/**
 * Document container of one path, or null when the extension is unsupported.
 *
 * Deliberately pure so both processes can classify a path without asking the
 * reading engine; the extension is read without `node:path` because renderer
 * code imports this module too.
 */
export function resolveDocumentContainer(filePath: string): DocumentContainer | null {
  return DOCUMENT_CONTAINER_BY_EXTENSION[fileExtension(filePath)] ?? null
}

/** Lowercase extension without its dot, empty when the last segment has none. */
function fileExtension(filePath: string): string {
  const separator = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  const fileName = filePath.slice(separator + 1)
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex > 0 ? fileName.slice(dotIndex + 1).toLowerCase() : ''
}

/**
 * Reads a stored container value back into its union.
 *
 * Probes write these columns, so a value can predate the current vocabulary;
 * an unrecognized one degrades to null and the caller treats the file as a
 * plain container rather than refusing to open it.
 */
export function parsePagedContainer(value: string | null): PagedContainer | null {
  return (PAGED_CONTAINERS as readonly string[]).includes(value ?? '')
    ? (value as PagedContainer)
    : null
}

/** Reads a stored document container value back into its union; see above. */
export function parseDocumentContainer(value: string | null): DocumentContainer | null {
  return (DOCUMENT_CONTAINERS as readonly string[]).includes(value ?? '')
    ? (value as DocumentContainer)
    : null
}
