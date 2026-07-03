# create-kisaki-extension

Creates Kisaki extension repositories and adds projects to generated extension
workspaces.

## Create A Repository

```bash
pnpm create kisaki-extension my-extension
```

The interactive `init` flow resolves workspace and registry choices only:

- the registry id/name/description becomes the durable registry manifest
  metadata; generated workspace package metadata is derived from it;
- the publish provider selects manual hosting or GitHub Release automation.

Every generated repository is a single workspace shape: a workspace root with
a registry manifest and an `extensions/` directory. Add extensions explicitly
with the `add` command after the workspace exists.

When no subcommand is provided, the scaffold detects generated Kisaki extension
workspaces and runs `add`; otherwise it runs `init`. Explicit `init` and `add`
commands always take precedence.

Registry package names are derived from stable registry IDs. The scaffold does
not ask for package names unless a future target format truly needs that
choice. Override registry metadata with `--registry-id`, `--registry-name`, or
`--registry-description`.

Use `--yes` with explicit flags for automation:

```bash
pnpm create kisaki-extension init my-extensions \
  --publish-provider github \
  --registry-id example \
  --registry-name "Example" \
  --registry-description "Kisaki extensions maintained by Example." \
  --yes
```

Dependencies are installed by default. `--no-install` skips installation,
`--no-git` skips Git initialization, and `--commit` creates a commit only after
generation and installation succeed.

## Add An Extension

From any generated extension workspace:

```bash
pnpm create kisaki-extension add example.theme \
  --name "Example Theme" \
  --description "Adds an example theme." \
  --categories theme \
  --starter theme \
  --webview none
```

The interactive `add` flow resolves extension choices:

- the extension ID/name/description becomes the generated manifest and package
  metadata;
- categories are manifest discovery metadata and support multiple values;
- the starter selects sample host behavior (`minimal`, `integration`,
  `scraper`, `theme`, or `tool`);
- the webview framework selects `none`, `vanilla`, or `vue`;
- webview addons select optional framework-specific layers such as
  `kisaki-ui-vue`.

`add` atomically creates `extensions/<extension-id>`, rebuilds the marked README
extension list, uses the workspace's publish provider, and refreshes the shared
lockfile. Use `--workspace` when invoking it outside the repository root.

## Generated Engineering Baseline

Generated projects include:

- private packages with `manifest.json` as the only extension version source;
- bundled Extension SDK/API development dependencies without duplicate runtime
  package copies;
- a root workspace `kisx` install and `pnpm run key:generate` command for the
  repository signing key;
- root TypeScript, ESLint, Prettier, and Lefthook wiring for workflow scripts,
  tooling scripts, and extension packages;
- strict host/UI/shared TypeScript and ESLint boundaries;
- Prettier, EditorConfig, Git attributes, MIT license, and pnpm workspace
  boundaries;
- Vite-based `kisx` build, validation, development, and packaging scripts;
- a static registry manifest updated through `kisx registry` commands;
- GitHub CI and signed publish workflows when the GitHub publish provider is
  selected.

The generated `engines.kisaki` value uses the recommended Extension API range
for the scaffold tooling version.

## Template Model

Templates are composable layers:

- `templates/workspace/base`
- `templates/workspace/publish-provider/<publish-provider>`
- `templates/extension/base`
- `templates/extension/starters/<starter>`
- `templates/extension/webview/base` when a webview is selected
- `templates/extension/webview/frameworks/<framework>`
- `templates/extension/webview/addons/<addon>`
- `templates/extension/publish-provider/<publish-provider>`

`kisx.config.ts` belongs to the selected webview framework layer because it
declares framework-specific Vite plugins. Host-only extensions use the kisx
defaults and do not receive an empty config file.

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
      "slot": "EXTENSION_PUBLISH_SECTION",
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

Template data flows in three layers: interactive options collect author-facing
intent, scaffold configuration validates that intent and derives technical
values such as package names, and template tokens describe the generated field
they write to, such as `WORKSPACE_PACKAGE_DESCRIPTION` or
`EXTENSION_MANIFEST_DESCRIPTION`.

GitHub publishing requires `KISAKI_EXTENSION_SIGNING_KEY`. Generate the
repository signing key from the workspace root with `pnpm run key:generate`,
store `.keys/author.ed25519.json` as that secret, and push a commit named
`publish(<extension-id>): v<semver>`; CI validates it and creates the
`<extension-id>-v<semver>` tag.

## Command Architecture

The scaffold CLI follows the same one-way layering as `kisx`:

- `src/cli/commands/` contains Commander declarations only;
- `src/cli/actions/` owns interactive workflows and terminal reporting;
- `src/scaffold/` and `src/extension-input.ts` own reusable generation rules.

Dependencies flow from commands to actions to domain modules.
