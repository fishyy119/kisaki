# Build & Release

## Key Files

### Build Configuration

- `apps/desktop/package.json` - Scripts and version
- `apps/desktop/tools/builtin-extensions/` - Built-in extension preparation for dev, preview, and production builds
- `apps/desktop/tools/bundler/` - In-repo Vite bundler (main/preload/renderer targets, dev orchestration)
- `apps/desktop/electron-builder.yml` - Electron Builder config
- `apps/desktop/tsconfig.*.json` - TypeScript configs

### Windows Installer

- `apps/desktop/electron-builder.yml` - Native NSIS target config
- `apps/desktop/build/installer.nsh` - NSIS custom hooks (`customInstall` / `customUnInstall`)
- `apps/desktop/build/x86-unicode/EnVar.dll` - EnVar plugin for PATH operations
- `apps/desktop/build/x86-ansi/EnVar.dll` - EnVar fallback plugin arch

### Monorepo

- `package.json` (root) - Workspace scripts
- `pnpm-workspace.yaml` - Workspace configuration
- `tsconfig.base.json` - Shared TypeScript config
- `eslint.config.ts` - ESLint flat config
- `.prettierrc.yaml` - Prettier config

## Build Pipeline

### Development

```bash
pnpm dev  # Start dev server with hot reload
```

`pnpm dev` routes to the desktop package and runs `tools/bundler/cli.ts dev`, a single orchestrator process that builds webview fonts, watches root `extensions/*` and serves their webview UI in-process (kisx programmatic API), runs the renderer dev server with HMR plus main/preload watch builds, and restarts Electron on main rebuilds. Electron is the only long-lived child process.

### Production Build

```bash
# From root
pnpm build           # Build all
pnpm build:win       # Windows (NSIS)
pnpm build:mac       # macOS (DMG)
pnpm build:linux     # Linux (AppImage, snap, deb)

# From apps/desktop
pnpm build:win:unpack  # Windows unpacked only
```

### Build Stages

1. **Built-in extensions**: `apps/desktop/tools/builtin-extensions/cli.ts build --target=resources` → `resources/extensions`
2. **TypeScript check**: `vue-tsc --noEmit`
3. **Vite build**: `tools/bundler/cli.ts build` → webview fonts + `out/` (ESM main + extension host, `.mjs` preload, renderer)
4. **Package**: `electron-builder` → `dist/`
5. **Windows installer**: `electron-builder` NSIS target → `*-setup.exe` + `latest.yml`

## Electron Builder Configuration

Key settings in `electron-builder.yml`:

```yaml
appId: com.kisaki.app
productName: Kisaki
directories:
  output: dist
files:
  - 'out/**/*'
  - 'drizzle/**/*' # Migrations must be included
asarUnpack:
  - '**/*.node' # Native modules
protocols:
  - name: Kisaki
    schemes: [kisaki]
```

## Windows NSIS

Requirements:

- No external installer dependency (uses electron-builder bundled NSIS)
- EnVar plugin DLL in build resources (`build/x86-unicode/EnVar.dll`)

Installer behavior:

1. Builds unpacked app (`dist/win-unpacked`)
2. Compiles NSIS installer via electron-builder
3. Runs custom NSIS macros from `build/installer.nsh`
4. Emits update metadata (`latest.yml`, blockmap)

## Protocol Registration

`kisaki://` deep link protocol:

- **Runtime**: Registered in main entry (pre-ready phase)
- **Packaging**: Declared in `electron-builder.yml`

## Monorepo Scripts

```bash
# Root level
pnpm dev                    # Start desktop dev
pnpm build                  # Build all packages
pnpm typecheck              # Type check all
pnpm lint                   # Lint all
pnpm format                 # Format all

# Extension tooling
pnpm check:extension-tooling       # Verify lockstep tooling version contract
pnpm version:extension-tooling 0.0.2
pnpm build:extension-tooling       # Build API, registry, SDK, CLI, and scaffold
```

### Script Routing

Root scripts use `--filter`:

```json
{
  "dev": "pnpm --filter kisaki dev",
  "build": "pnpm --filter kisaki build"
}
```

## Extension Tooling Build

Extension tooling packages use a single lockstep version:

- `@kisaki3/extension-api`
- `@kisaki3/extension-registry`
- `@kisaki3/extension-sdk`
- `@kisaki3/extension-ui-vue`
- `@kisaki3/extension-cli`
- `create-kisaki-extension`

`tools/extension-tooling/cli.ts` owns the version contract, version bump helper, build ordering,
output verification, and package listing. Extension tooling release tarball creation and npm
publishing are GitHub release workflow implementation details under
`.github/scripts/release/targets/extension-tooling/`. Do not add package-specific release jobs for
these packages.

Contract and tooling pipeline:

```bash
pnpm build:extension-tooling    # extension-api + extension-registry + extension-sdk + extension-cli + scaffold
```

Release tags:

```text
desktop-v0.0.2
extension-tooling-v0.0.2
```

Tools used:

- `tsdown` - TypeScript bundling
- `kisx` - Extension project build, validation, packaging, and dev entry

## Search Patterns

- Build scripts: `build:win`, `build:mac`, `build:linux`, `build:win:unpack`
- Packaging: `files:`, `asarUnpack:`, `protocols:`, `publish:`
- Windows: `nsis`, `installer.nsh`, `EnVar.dll`, `latest.yml`
- Protocol: `setAsDefaultProtocolClient`, `kisaki` scheme
- Workspace: `pnpm --filter`, `pnpm -r --parallel`
- Tools: `tools/bundler`, `electron-builder`, `drizzle-kit`
- Built-in extensions: `prepare-builtin-extensions`, `resources/extensions`, `out/extensions`, `extensions/*`

## Procedures

### Release Build Checklist

1. **Version check**:
   - `apps/desktop/package.json`: `version`
   - `electron-builder.yml`: `appId`, `productName`
   - Extension tooling: `pnpm check:extension-tooling <version>`

2. **Build for target platform**:

   ```bash
   pnpm build:win   # or build:mac, build:linux
   ```

3. **Verify output**:
   - `apps/desktop/dist/` contains platform artifacts
   - Windows: `kisaki-<version>-setup.exe` + `latest.yml`

4. **Verify critical paths**:
   - `kisaki://` protocol works
   - CLI shim works: `kisaki` resolves after install (PATH update via EnVar)
   - DB migrations run on startup
   - Extensions load correctly

### Adjusting Build Configuration

1. Identify scope: root, `apps/desktop`, or `packages/*`
2. Search for script call chain
3. After changes, verify:
   - TypeScript: `tsconfig.base.json` + package tsconfigs
   - Aliases: `tools/bundler/targets.ts` + tsconfig `paths`
   - ESLint/Prettier consistency

## Constraints

- `drizzle/` migrations must be included in package
- Native modules (`.node`) must be in `asarUnpack`
- Built-in extensions are generated into `resources/extensions` before packaging and must be kept in `asarUnpack` through `resources/**`.
- Protocol must be registered both at runtime and in builder config
- `publish` config is placeholder; auto-update requires additional setup

## Notes

- Dev mode uses `dev/app` folder for userData
- `--dev-extension` flag enables extension development mode
- `latest.yml` format compatible with electron-updater

## Related

- [Architecture](architecture.md) - Bootstrap sequence
- [Data Layer](data-layer.md) - Migration packaging
- [Extension System](extension-system.md) - Extension tooling
- [Changelog](changelog.md) - Release changelog writing contract
