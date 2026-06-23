import { access, mkdir, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { BuiltinExtensionToolContext } from './types'

/** Finds built-in extension project directories under the repository extensions root. */
export async function findBuiltinExtensionProjects(
  context: BuiltinExtensionToolContext
): Promise<string[]> {
  await mkdir(context.builtinExtensionsRoot, { recursive: true })

  const entries = await readdir(context.builtinExtensionsRoot, { withFileTypes: true })
  const projects: string[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const projectDir = path.join(context.builtinExtensionsRoot, entry.name)
    const manifestPath = path.join(projectDir, 'manifest.json')

    try {
      await access(manifestPath)
      projects.push(projectDir)
    } catch {
      continue
    }
  }

  return projects.sort((left, right) => left.localeCompare(right, 'en'))
}

/** Filters built-in extension projects that declare webview UI entries. */
export async function findBuiltinExtensionProjectsWithUi(
  projects: readonly string[]
): Promise<string[]> {
  const uiProjects: string[] = []

  for (const project of projects) {
    if (await hasBuiltinExtensionUi(project)) {
      uiProjects.push(project)
    }
  }

  return uiProjects
}

async function hasBuiltinExtensionUi(projectDir: string): Promise<boolean> {
  try {
    const manifest = JSON.parse(
      await readFile(path.join(projectDir, 'manifest.json'), 'utf8')
    ) as Record<string, unknown>
    return typeof manifest.ui === 'string' && manifest.ui.trim().length > 0
  } catch {
    return false
  }
}
