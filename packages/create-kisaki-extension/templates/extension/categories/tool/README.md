# {{EXTENSION_NAME}}

{{DESCRIPTION}}

## Scripts

```bash
npm run build
npm run validate
npm run pack
npm run dev
```

## Project Layout

- `src/host/` - Node host code; `src/host/index.ts` is the entry bundled to
  `manifest.entry`.
- `src/ui/<view>/index.html` - webview documents, built into `dist/ui`
  (declared as `"ui"` in `manifest.json`).
- `src/shared/` - RPC contracts and DTOs imported by both sides; it must not
  import from `host` or `ui`.

## Webview UI

The host entry opens documents with `kisaki.webviews.open()` and talks to them
through `createWebviewRpc`. Documents import Tailwind plus the SDK base layer
(`@kisaki3/extension-sdk/base.css`) and Tailwind bridge
(`@kisaki3/extension-sdk/tailwind.css`), so they style with the same semantic
utilities as the app. During `npm run dev`, webview documents serve
from a Vite dev server with full HMR; host entry changes republish the package
and recycle the extension host.

## Package

```bash
kisx pack
kisx pack --out-dir artifacts --no-build
```

{{PUBLISH_SECTION}}
