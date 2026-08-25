/**
 * Book content protocol contract.
 *
 * The `book://` scheme streams reading content out of unit file rows: comic
 * pages by index, and whole book files for engines that parse the container
 * themselves. URLs reference database file-row ids, never raw paths, so the
 * handler resolves and confines every request to a row the library owns.
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
