import { existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const EXTENSIONS_START_MARKER = '<!-- extensions:start -->'
const EXTENSIONS_END_MARKER = '<!-- extensions:end -->'

interface WorkspaceExtensionEntry {
  id: string
  name: string
}

interface WorkspacePackageJson {
  name?: unknown
  packageManager?: unknown
  private?: unknown
}

/** Validates the generated monorepository boundary required by the add command. */
export function validateExtensionWorkspace(workspaceDir: string): void {
  for (const relativePath of ['package.json', 'pnpm-workspace.yaml', 'extensions', 'README.md']) {
    if (!existsSync(path.join(workspaceDir, relativePath))) {
      throw new Error(`Not a Kisaki extension workspace: missing ${relativePath}.`)
    }
  }

  if (!statSync(path.join(workspaceDir, 'extensions')).isDirectory()) {
    throw new Error('Not a Kisaki extension workspace: extensions must be a directory.')
  }

  const packageJson = readWorkspacePackageJson(path.join(workspaceDir, 'package.json'))
  if (
    typeof packageJson.name !== 'string' ||
    !packageJson.name ||
    packageJson.private !== true ||
    typeof packageJson.packageManager !== 'string' ||
    !packageJson.packageManager.startsWith('pnpm@')
  ) {
    throw new Error(
      'Not a Kisaki extension workspace: package.json must declare a name, private: true, and pnpm packageManager.'
    )
  }

  const workspaceDefinition = readFileSync(path.join(workspaceDir, 'pnpm-workspace.yaml'), 'utf8')
  if (!/^\s*-\s+['"]?extensions\/\*['"]?\s*$/mu.test(workspaceDefinition)) {
    throw new Error(
      'Not a Kisaki extension workspace: pnpm-workspace.yaml must include extensions/*.'
    )
  }

  const readme = path.join(workspaceDir, 'README.md')
  const content = readFileSync(readme, 'utf8')
  if (!content.includes(EXTENSIONS_START_MARKER) || !content.includes(EXTENSIONS_END_MARKER)) {
    throw new Error('Workspace README.md is missing the generated extension-list markers.')
  }
}

function readWorkspacePackageJson(filePath: string): WorkspacePackageJson {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as WorkspacePackageJson
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error'
    throw new Error(`Could not read workspace package.json: ${detail}`)
  }
}

/** Rebuilds the generated README extension list from project manifests. */
export function updateWorkspaceExtensionList(workspaceDir: string): void {
  const readmePath = path.join(workspaceDir, 'README.md')
  const original = readFileSync(readmePath, 'utf8')
  const entries = readWorkspaceExtensions(path.join(workspaceDir, 'extensions'))
  const list = entries
    .map((entry) => `- \`${entry.id}\` — ${entry.name} (\`extensions/${entry.id}\`)`)
    .join('\n')
  const replacement = `${EXTENSIONS_START_MARKER}\n\n${list}\n${EXTENSIONS_END_MARKER}`
  const pattern = new RegExp(`${EXTENSIONS_START_MARKER}[\\s\\S]*?${EXTENSIONS_END_MARKER}`)
  const updated = original.replace(pattern, replacement)
  const tempPath = `${readmePath}.tmp-${process.pid}`
  writeFileSync(tempPath, updated)
  renameSync(tempPath, readmePath)
}

function readWorkspaceExtensions(extensionsDir: string): WorkspaceExtensionEntry[] {
  const entries: WorkspaceExtensionEntry[] = []
  for (const dirent of readdirSync(extensionsDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue
    }

    const manifestPath = path.join(extensionsDir, dirent.name, 'manifest.json')
    if (!existsSync(manifestPath)) {
      continue
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
    if (typeof manifest.id !== 'string' || typeof manifest.name !== 'string') {
      throw new Error(`Invalid extension identity in ${manifestPath}.`)
    }
    entries.push({ id: manifest.id, name: manifest.name })
  }
  return entries.toSorted((left, right) => left.id.localeCompare(right.id, 'en'))
}
