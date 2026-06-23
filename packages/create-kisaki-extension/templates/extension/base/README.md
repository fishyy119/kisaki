# {{EXTENSION_NAME}}

{{DESCRIPTION}}

## Metadata

- Extension ID: `{{EXTENSION_ID}}`
- Categories: {{CATEGORIES_LABEL}}
- Starter: `__STARTER__`
- Webview: `__WEBVIEW__`

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

{{PUBLISH_SECTION}}
