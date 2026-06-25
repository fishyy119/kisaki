import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { create, extract } from 'tar'

const packageRoot = 'package'
const packedPackageJsonPath = path.join(packageRoot, 'package.json')
const sortableDependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'peerDependenciesMeta'
] as const

interface JsonObject {
  [key: string]: unknown
}

export function canonicalizePackageTarball(tarballPath: string): void {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'kisaki-extension-tooling-pack-'))

  try {
    extract({
      file: tarballPath,
      cwd: tempDir,
      sync: true,
      strict: true,
      preserveOwner: false,
      chmod: true,
      processUmask: 0
    })

    canonicalizePackedPackageJson(path.join(tempDir, packedPackageJsonPath))

    const entries = collectArchiveEntries(tempDir)
    rmSync(tarballPath, { force: true })

    create(
      {
        file: tarballPath,
        cwd: tempDir,
        gzip: true,
        portable: true,
        noMtime: true,
        sync: true,
        strict: true
      },
      entries
    )
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

function canonicalizePackedPackageJson(packageJsonPath: string): void {
  if (!existsSync(packageJsonPath)) {
    throw new Error(`Package tarball is missing ${toPosixPath(packedPackageJsonPath)}.`)
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as unknown
  if (!isPlainObject(packageJson)) {
    throw new Error('Packed package.json must be an object.')
  }

  const canonicalPackageJson: JsonObject = { ...packageJson }
  for (const fieldName of sortableDependencyFields) {
    const value = canonicalPackageJson[fieldName]
    if (value === undefined) {
      continue
    }

    if (!isPlainObject(value)) {
      throw new Error(`Packed package.json field ${fieldName} must be an object.`)
    }

    canonicalPackageJson[fieldName] = sortObjectByKey(value)
  }

  writeFileSync(packageJsonPath, `${JSON.stringify(canonicalPackageJson, null, 2)}\n`, 'utf-8')
}

function collectArchiveEntries(root: string): string[] {
  const entries: string[] = []
  collectArchiveEntriesRecursive(root, path.join(root, packageRoot), entries)
  return entries.sort((left, right) => left.localeCompare(right))
}

function collectArchiveEntriesRecursive(
  root: string,
  currentPath: string,
  entries: string[]
): void {
  if (!existsSync(currentPath)) {
    throw new Error(`Package tarball is missing ${packageRoot}/ root.`)
  }

  const stat = lstatSync(currentPath)
  if (stat.isDirectory()) {
    for (const childName of readdirSorted(currentPath)) {
      collectArchiveEntriesRecursive(root, path.join(currentPath, childName), entries)
    }
    return
  }

  if (!stat.isFile() && !stat.isSymbolicLink()) {
    throw new Error(
      `Unsupported packed package entry: ${toPosixPath(path.relative(root, currentPath))}`
    )
  }

  const relativePath = toPosixPath(path.relative(root, currentPath))
  if (!relativePath.startsWith(`${packageRoot}/`)) {
    throw new Error(`Packed package entry escapes package root: ${relativePath}`)
  }
  entries.push(relativePath)
}

function readdirSorted(dir: string): string[] {
  return readdirSync(dir).sort((left, right) => left.localeCompare(right))
}

function sortObjectByKey(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  )
}

function isPlainObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/')
}
