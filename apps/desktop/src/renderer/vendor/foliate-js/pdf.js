/**
 * Local stub replacing upstream pdf.js.
 *
 * The upstream module depends on a vendored pdfjs-dist build that Kisaki does
 * not bundle; the reader treats PDF volumes as unsupported instead. The stub
 * keeps `view.js` untouched, since its `makeBook` resolves this module path.
 */
export const makePDF = async () => {
  throw new Error('PDF rendering is not bundled')
}
