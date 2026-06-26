import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const TEMPLATE_MANIFEST_FILE = 'template.json'

type TemplatePatchOperation = 'json.merge' | 'text.slot'

interface TemplateManifestRecord {
  version?: unknown
  patches?: unknown
}

interface TemplatePatchRecord {
  op?: unknown
  target?: unknown
  source?: unknown
  slot?: unknown
}

interface JsonMergePatch {
  op: 'json.merge'
  target: string
  source: string
}

interface TextSlotPatch {
  op: 'text.slot'
  target: string
  slot: string
  source: string
}

type TemplatePatch = JsonMergePatch | TextSlotPatch

export interface TemplateMergeManifest {
  version: 1
  patches: readonly TemplatePatch[]
}

export interface ApplyTemplateMergeOptions {
  sourceDir: string
  targetDir: string
  renderTemplate(content: string, targetPath: string): string
}

/** Reads and validates one template layer merge manifest. */
export function readTemplateMergeManifest(layerDir: string): TemplateMergeManifest {
  const manifestPath = path.join(layerDir, TEMPLATE_MANIFEST_FILE)
  if (!existsSync(manifestPath)) {
    return { version: 1, patches: [] }
  }

  const value = JSON.parse(readFileSync(manifestPath, 'utf8')) as TemplateManifestRecord
  if (!isPlainRecord(value)) {
    throw new Error(`${TEMPLATE_MANIFEST_FILE} must contain a JSON object.`)
  }
  if (value.version !== 1) {
    throw new Error(`${TEMPLATE_MANIFEST_FILE} version must be 1.`)
  }
  if (value.patches === undefined) {
    return { version: 1, patches: [] }
  }
  if (!Array.isArray(value.patches)) {
    throw new Error(`${TEMPLATE_MANIFEST_FILE} patches must be an array.`)
  }

  return {
    version: 1,
    patches: value.patches.map((patch, index) => parseTemplatePatch(patch, index))
  }
}

/** Returns manifest source files that must not be copied as ordinary template files. */
export function getTemplateMergeSourcePaths(manifest: TemplateMergeManifest): Set<string> {
  return new Set(manifest.patches.map((patch) => patch.source))
}

/** Applies all merge operations declared by one template layer. */
export function applyTemplateMergeManifest(
  manifest: TemplateMergeManifest,
  options: ApplyTemplateMergeOptions
): void {
  for (const patch of manifest.patches) {
    if (patch.op === 'json.merge') {
      applyJsonMergePatch(patch, options)
      continue
    }

    applyTextSlotPatch(patch, options)
  }
}

function parseTemplatePatch(value: unknown, index: number): TemplatePatch {
  if (!isPlainRecord(value)) {
    throw new Error(`template patch ${index + 1} must be a JSON object.`)
  }

  const record = value as TemplatePatchRecord
  const op = requirePatchOperation(record.op, index)
  const target = requireManifestPath(record.target, `template patch ${index + 1} target`)
  const source = requireManifestPath(record.source, `template patch ${index + 1} source`)

  if (op === 'json.merge') {
    return { op, target, source }
  }

  return {
    op,
    target,
    source,
    slot: requireSlotName(record.slot, index)
  }
}

function requirePatchOperation(value: unknown, index: number): TemplatePatchOperation {
  if (value === 'json.merge' || value === 'text.slot') {
    return value
  }
  throw new Error(`template patch ${index + 1} has unsupported op: ${String(value)}.`)
}

function requireManifestPath(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`)
  }
  if (value.includes('\\')) {
    throw new Error(`${label} must use POSIX-style "/" separators.`)
  }
  if (path.posix.isAbsolute(value)) {
    throw new Error(`${label} must be relative.`)
  }

  const normalized = path.posix.normalize(value)
  if (normalized === '.' || normalized.startsWith('../') || normalized === '..') {
    throw new Error(`${label} must stay inside the template layer.`)
  }
  return normalized
}

function requireSlotName(value: unknown, index: number): string {
  if (typeof value !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(value)) {
    throw new Error(`template patch ${index + 1} slot must be an upper snake case name.`)
  }
  return value
}

function applyJsonMergePatch(patch: JsonMergePatch, options: ApplyTemplateMergeOptions): void {
  const sourcePath = resolveConfinedPath(options.sourceDir, patch.source, 'JSON merge source')
  const targetPath = resolveConfinedPath(options.targetDir, patch.target, 'JSON merge target')

  if (!existsSync(sourcePath)) {
    throw new Error(`JSON merge source not found: ${patch.source}.`)
  }
  if (!existsSync(targetPath)) {
    throw new Error(`JSON merge target not found: ${patch.target}.`)
  }

  const renderedPatch = options.renderTemplate(readFileSync(sourcePath, 'utf8'), targetPath)
  const target = readJsonObject(targetPath, `JSON merge target ${patch.target}`)
  const source = parseJsonObject(renderedPatch, `JSON merge source ${patch.source}`)
  writeFileSync(targetPath, `${JSON.stringify(deepMergeJson(target, source), null, 2)}\n`)
}

function applyTextSlotPatch(patch: TextSlotPatch, options: ApplyTemplateMergeOptions): void {
  const sourcePath = resolveConfinedPath(options.sourceDir, patch.source, 'text slot source')
  const targetPath = resolveConfinedPath(options.targetDir, patch.target, 'text slot target')

  if (!existsSync(sourcePath)) {
    throw new Error(`Text slot source not found: ${patch.source}.`)
  }
  if (!existsSync(targetPath)) {
    throw new Error(`Text slot target not found: ${patch.target}.`)
  }

  const targetContent = readFileSync(targetPath, 'utf8')
  const token = `{{${patch.slot}}}`
  const tokenCount = countOccurrences(targetContent, token)
  if (tokenCount !== 1) {
    throw new Error(
      `Text slot ${patch.slot} must appear exactly once in ${patch.target}; found ${tokenCount}.`
    )
  }

  const renderedSource = options
    .renderTemplate(readFileSync(sourcePath, 'utf8'), targetPath)
    .trimEnd()
  const updated = targetContent.replace(token, renderedSource)
  writeFileSync(targetPath, updated)
}

function resolveConfinedPath(rootDir: string, relativePath: string, label: string): string {
  const root = path.resolve(rootDir)
  const resolved = path.resolve(root, relativePath)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} escapes its template boundary: ${relativePath}.`)
  }
  return resolved
}

function readJsonObject(filePath: string, label: string): Record<string, unknown> {
  return parseJsonObject(readFileSync(filePath, 'utf8'), label)
}

function parseJsonObject(content: string, label: string): Record<string, unknown> {
  const value = JSON.parse(content) as unknown
  if (!isPlainRecord(value)) {
    throw new Error(`${label} must contain a JSON object.`)
  }
  return value
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

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
