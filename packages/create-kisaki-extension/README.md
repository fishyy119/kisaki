# create-kisaki-extension

Creates standalone Kisaki extension repositories and adds projects to generated
extension monorepositories.

## Create A Repository

```bash
pnpm create kisaki-extension init my-extension
```

The interactive flow resolves three independent choices:

- categories are manifest discovery metadata and support multiple values;
- the starter selects sample host behavior (`minimal`, `integration`,
  `scraper`, `theme`, or `tool`);
- the webview implementation selects `none`, `vanilla`, `vue`, or `vue-kit`.

Use `--yes` with explicit flags for automation:

```bash
pnpm create kisaki-extension init my-extensions \
  --publish github-monorepo \
  --extension-id example.integration \
  --package-name @example/integration \
  --extension-name "Example Integration" \
  --categories integration,tool \
  --starter integration \
  --webview vue-kit \
  --author Example \
  --yes
```

Dependencies are installed by default. `--no-install` skips installation,
`--no-git` skips Git initialization, and `--commit` creates a commit only after
generation and installation succeed.

## Add An Extension

From a generated GitHub extension monorepository:

```bash
pnpm create kisaki-extension add example.theme \
  --package-name @example/theme \
  --categories theme \
  --starter theme \
  --webview none
```

`add` atomically creates `extensions/<extension-id>`, rebuilds the marked
README extension list, and refreshes the shared lockfile. Use `--workspace`
when invoking it outside the repository root.

## Generated Engineering Baseline

Generated projects include:

- private packages with `manifest.json` as the only extension version source;
- bundled Extension SDK/API development dependencies without duplicate runtime
  package copies;
- strict host/UI/shared TypeScript and ESLint boundaries;
- Prettier, EditorConfig, Git attributes, MIT license, and pnpm workspace
  boundaries;
- Vite-based `kisx` build, validation, development, and packaging scripts;
- frozen-lockfile CI and release-commit-driven signed GitHub releases;
- a static registry manifest updated through `kisx registry` commands.

The generated `engines.kisaki` value uses the recommended Extension API range
for the scaffold tooling version.

## Template Model

Templates are composable layers:

- `templates/workspace/base`
- `templates/workspace/publish/<workflow>`
- `templates/extension/base`
- `templates/extension/starters/<starter>`
- `templates/extension/webview/base` when a webview is selected
- `templates/extension/webview/<implementation>`

Files named `<name>.patch.json` deep-merge into JSON produced by earlier layers.
Objects merge recursively; arrays and scalar values replace. Template tokens
are escaped according to JSON/YAML, TypeScript, Vue, or raw text context.

GitHub releases require `KISAKI_EXTENSION_SIGNING_KEY`. Push a commit named
`release(<extension-id>): v<semver>`; CI validates it and creates the
`<extension-id>-v<semver>` tag.

## Command Architecture

The scaffold CLI follows the same one-way layering as `kisx`:

- `src/cli/commands/` contains Commander declarations only;
- `src/cli/actions/` owns interactive workflows and terminal reporting;
- `src/scaffold/` and `src/extension-input.ts` own reusable generation rules.

Dependencies flow from commands to actions to domain modules.
