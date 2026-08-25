# foliate-js (vendored)

Source: <https://github.com/johnfactotum/foliate-js>, commit
`78914aef4466eb960965702401634c2cb348e9b1` (MIT, see `LICENSE`).

Vendored because upstream does not publish maintained npm releases. Only the
rendering core is included (no demo UI, OPDS, or dictionary modules).

Local deviations from upstream:

- `paginator.js` and `fixed-layout.js` render section iframes with
  `sandbox="allow-same-origin"` instead of upstream's
  `"allow-same-origin allow-scripts"`. Upstream grants `allow-scripts` only to
  work around a WebKit event bug that Chromium does not have; withholding it
  means a book's own scripts never execute. This is the innermost of the three
  layers that keep foreign book content inert — the others are the reader
  window's `script-src 'self'` policy and the script-resource rejection wired
  up in `@renderer/core/reader/foliate`.
- `pdf.js` is a stub that throws: the upstream module requires a vendored
  pdfjs-dist build we do not bundle. PDF files never reach foliate — the
  in-house fixed-layout engine renders them for both comics and novels.
- `vendor/zip.js` and `vendor/fflate.js` re-export the `@zip.js/zip.js` and
  `fflate` npm packages instead of carrying prebuilt bundles.

Everything else is byte-identical to upstream. When updating, re-copy the
modules listed here and re-apply these deviations.
