# {{EXTENSION_README_TITLE}}

{{EXTENSION_README_DESCRIPTION}}

## Metadata

- Extension ID: `{{EXTENSION_ID}}`
- Categories: {{EXTENSION_CATEGORIES_LABEL}}
- Starter: `{{EXTENSION_STARTER}}`
- Webview: {{EXTENSION_WEBVIEW_LABEL}}
- Webview addons: {{EXTENSION_WEBVIEW_ADDONS_LABEL}}

## Project Layout

- `src/host/` contains Node.js extension-host code.
- `src/ui/` contains isolated webview documents when UI is enabled.
- `src/shared/` contains pure contracts shared by the host and webview sides.

## Development

```bash
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm run build
pnpm run validate
pnpm run dev
```

## Package

```bash
pnpm run pack
```

{{EXTENSION_PUBLISH_SECTION}}
