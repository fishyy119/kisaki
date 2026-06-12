import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const JSON_PATCH_SUFFIX = '.patch.json'

export function isJsonPatchFile(fileName: string): boolean {
  return fileName.endsWith(JSON_PATCH_SUFFIX)
}

export function resolvePatchTargetFileName(patchFileName: string): string {
  return `${patchFileName.slice(0, -JSON_PATCH_SUFFIX.length)}.json`
}

/**
 * Deep-merges a rendered `<name>.patch.json` template into the already
 * scaffolded `<name>.json` next to it. Earlier layers must have produced the
 * target file; objects merge recursively, arrays and scalars replace.
 */
export function applyJsonPatch(targetPath: string, renderedPatchContent: string): void {
  if (!existsSync(targetPath)) {
    throw new Error(
      `JSON patch target not found: ${path.basename(targetPath)} must be scaffolded by an earlier template layer.`
    )
  }

  const target = JSON.parse(readFileSync(targetPath, 'utf-8')) as Record<string, unknown>
  const patch = JSON.parse(renderedPatchContent) as Record<string, unknown>
  writeFileSync(targetPath, `${JSON.stringify(deepMergeJson(target, patch), null, 2)}\n`)
}

function deepMergeJson(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base }

  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = merged[key]
    if (isPlainRecord(baseValue) && isPlainRecord(patchValue)) {
      merged[key] = sortRecordIfDependencies(key, deepMergeJson(baseValue, patchValue))
      continue
    }

    merged[key] = patchValue
  }

  return merged
}

function sortRecordIfDependencies(
  key: string,
  value: Record<string, unknown>
): Record<string, unknown> {
  if (key !== 'dependencies' && key !== 'devDependencies') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right, 'en'))
  )
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
