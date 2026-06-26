# create-kisaki-extension

Creates standalone Kisaki extension repositories and adds projects to generated
extension monorepositories.

## Create A Repository

```bash
pnpm create kisaki-extension my-extension
```

The interactive flow resolves the repository, extension, and webview choices:

- the repository layout selects a single extension repository or an extension
  monorepository;
- the release provider selects manual/custom hosting or GitHub Releases;
- categories are manifest discovery metadata and support multiple values;
- the starter selects sample host behavior (`minimal`, `integration`,
  `scraper`, `theme`, or `tool`);
- the webview framework selects `none`, `vanilla`, or `vue`;
- webview addons select optional framework-specific layers such as
  `kisaki-ui-vue`.

When no subcommand is provided, the scaffold detects generated Kisaki extension
monorepositories and runs `add`; otherwise it runs `init`. Explicit `init` and
`add` commands always take precedence.

The final extension ID is the source for the default package and display names.
Use `--package-name` or `--extension-name` only when the generated defaults need
an explicit override.

Use `--yes` with explicit flags for automation:

```bash
pnpm create kisaki-extension init my-extensions \
  --layout monorepo \
  --provider github \
  --extension-id example.integration \
  --package-name @example/integration \
  --extension-name "Example Integration" \
  --categories integration,tool \
  --starter integration \
  --webview vue \
  --webview-addon kisaki-ui-vue \
  --author Example \
  --yes
```

Dependencies are installed by default. `--no-install` skips installation,
`--no-git` skips Git initialization, and `--commit` creates a commit only after
generation and installation succeed.

## Add An Extension

From any generated extension monorepository:

```bash
pnpm create kisaki-extension add example.theme \
  --package-name @example/theme \
  --categories theme \
  --starter theme \
  --webview none
```

`add` atomically creates `extensions/<extension-id>`, rebuilds the marked
README extension list, uses the monorepo's release provider, and refreshes the
shared lockfile. Use `--workspace` when invoking it outside the repository
root.

## Generated Engineering Baseline

Generated projects include:

- private packages with `manifest.json` as the only extension version source;
- bundled Extension SDK/API development dependencies without duplicate runtime
  package copies;
- strict host/UI/shared TypeScript and ESLint boundaries;
- Prettier, EditorConfig, Git attributes, MIT license, and pnpm workspace
  boundaries;
- Vite-based `kisx` build, validation, development, and packaging scripts;
- a static registry manifest updated through `kisx registry` commands;
- GitHub CI and signed release workflows when the GitHub provider is selected.

The generated `engines.kisaki` value uses the recommended Extension API range
for the scaffold tooling version.

## Template Model

Templates are composable layers:

- `templates/workspace/base`
- `templates/workspace/layout/<layout>`
- `templates/workspace/provider/<provider>/<layout>`
- `templates/extension/base`
- `templates/extension/starters/<starter>`
- `templates/extension/webview/base` when a webview is selected
- `templates/extension/webview/frameworks/<framework>`
- `templates/extension/webview/addons/<addon>`
- `templates/extension/provider/<provider>/<layout>`

Layer files are copied after token rendering. A layer can also declare
`template.json` merge operations:

```json
{
  "version": 1,
  "patches": [
    { "op": "json.merge", "target": "package.json", "source": "patches/package.json" },
    {
      "op": "text.slot",
      "target": "README.md",
      "slot": "PUBLISH_SECTION",
      "source": "patches/publish.md"
    }
  ]
}
```

`json.merge` recursively merges objects into files produced by earlier layers;
arrays and scalar values replace. `text.slot` replaces exactly one
`{{SLOT_NAME}}` marker. Patch sources are rendered but not copied. Template
tokens use `{{UPPER_SNAKE_CASE}}` and are escaped according to JSON/YAML,
TypeScript, Vue, HTML, or raw text context.

GitHub releases require `KISAKI_EXTENSION_SIGNING_KEY`. Push a commit named
`release(<extension-id>): v<semver>`; CI validates it and creates the
`<extension-id>-v<semver>` tag.

## Command Architecture

The scaffold CLI follows the same one-way layering as `kisx`:

- `src/cli/commands/` contains Commander declarations only;
- `src/cli/actions/` owns interactive workflows and terminal reporting;
- `src/scaffold/` and `src/extension-input.ts` own reusable generation rules.

Dependencies flow from commands to actions to domain modules.
