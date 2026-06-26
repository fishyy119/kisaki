# create-kisaki-extension

Creates Kisaki extension repositories and adds projects to generated extension
workspaces.

## Create A Repository

```bash
pnpm create kisaki-extension my-extension
```

The interactive flow resolves author-facing registry, extension, and webview
choices:

- the registry id/name/description becomes the durable registry manifest
  metadata; generated workspace package metadata is derived from it;
- the release provider selects manual/custom hosting or GitHub Releases;
- categories are manifest discovery metadata and support multiple values;
- the starter selects sample host behavior (`minimal`, `integration`,
  `scraper`, `theme`, or `tool`);
- the webview framework selects `none`, `vanilla`, or `vue`;
- webview addons select optional framework-specific layers such as
  `kisaki-ui-vue`.

Every generated repository is a single workspace shape: a workspace root with
a registry manifest and an `extensions/` directory. A repository that hosts one
extension is just a workspace with one entry under `extensions/`, so `add`
works from the start.

When no subcommand is provided, the scaffold detects generated Kisaki extension
workspaces and runs `add`; otherwise it runs `init`. Explicit `init` and `add`
commands always take precedence.

Registry and extension package names are derived from their stable IDs. The
scaffold does not ask for package names unless a future target format truly
needs that choice. Override the user-facing extension name with
`--extension-name` when the generated name is not specific enough. Override
registry metadata with `--registry-id`, `--registry-name`, or
`--registry-description`.

Use `--yes` with explicit flags for automation:

```bash
pnpm create kisaki-extension init my-extensions \
  --provider github \
  --registry-id example \
  --registry-name "Example" \
  --registry-description "Kisaki extensions maintained by Example." \
  --extension-id example.integration \
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

From any generated extension workspace:

```bash
pnpm create kisaki-extension add example.theme \
  --categories theme \
  --starter theme \
  --webview none
```

`add` atomically creates `extensions/<extension-id>`, rebuilds the marked
README extension list, uses the workspace's release provider, and refreshes the
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
- `templates/workspace/provider/<provider>`
- `templates/extension/base`
- `templates/extension/starters/<starter>`
- `templates/extension/webview/base` when a webview is selected
- `templates/extension/webview/frameworks/<framework>`
- `templates/extension/webview/addons/<addon>`
- `templates/extension/provider/<provider>`

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

GitHub releases require `KISAKI_EXTENSION_SIGNING_KEY`. Push a commit named
`release(<extension-id>): v<semver>`; CI validates it and creates the
`<extension-id>-v<semver>` tag.

## Command Architecture

The scaffold CLI follows the same one-way layering as `kisx`:

- `src/cli/commands/` contains Commander declarations only;
- `src/cli/actions/` owns interactive workflows and terminal reporting;
- `src/scaffold/` and `src/extension-input.ts` own reusable generation rules.

Dependencies flow from commands to actions to domain modules.
