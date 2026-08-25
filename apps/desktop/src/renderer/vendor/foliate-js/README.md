# foliate-js (vendored)

Source: <https://github.com/johnfactotum/foliate-js>, commit
`78914aef4466eb960965702401634c2cb348e9b1` (MIT, see `LICENSE`).

Vendored because upstream does not publish maintained npm releases. Only the
rendering core is included (no demo UI, OPDS, or dictionary modules).

Local deviations from upstream:

- `pdf.js` is a stub that throws: the upstream module requires a vendored
  pdfjs-dist build we do not bundle. PDF novel files are reported as
  unsupported by the reader instead.
- `vendor/zip.js` and `vendor/fflate.js` re-export the `@zip.js/zip.js` and
  `fflate` npm packages instead of carrying prebuilt bundles.

Everything else is byte-identical to upstream. When updating, re-copy the
modules listed here and keep these three shims.
