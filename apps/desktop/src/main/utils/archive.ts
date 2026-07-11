/**
 * Archive utilities - streaming zip compression/extraction built on fflate.
 */

import { once } from 'node:events'
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough, type UnzipFile } from 'fflate'
import { emptyDir, pathExists } from './fs'

/**
 * Compress a directory into a zip file
 *
 * @param sourceDir - Source directory to compress
 * @param outputPath - Output zip file path
 * @returns Size of the created zip file in bytes
 */
export async function compressDir(sourceDir: string, outputPath: string): Promise<number> {
  if (!(await pathExists(sourceDir))) {
    throw new Error(`Source directory not found: ${sourceDir}`)
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  const { files, emptyDirs } = await collectZipEntries(sourceDir)

  const output = createWriteStream(outputPath)
  let written = 0
  const outputClosed = new Promise<void>((resolve, reject) => {
    output.once('close', resolve)
    output.once('error', reject)
  })

  const zip = new Zip((error, chunk, final) => {
    if (error) {
      output.destroy(error)
      return
    }
    written += chunk.length
    output.write(chunk)
    if (final) {
      output.end()
    }
  })

  try {
    for (const dirName of emptyDirs) {
      const entry = new ZipPassThrough(`${dirName}/`)
      zip.add(entry)
      entry.push(new Uint8Array(0), true)
    }

    for (const fileName of files) {
      const entry = new ZipDeflate(fileName, { level: 6 })
      zip.add(entry)

      for await (const chunk of createReadStream(path.join(sourceDir, fileName))) {
        entry.push(chunk as Buffer)
        if (output.writableNeedDrain) {
          await once(output, 'drain')
        }
      }
      entry.push(new Uint8Array(0), true)
    }

    zip.end()
    await outputClosed
    return written
  } catch (error) {
    zip.terminate()
    output.destroy()
    throw error
  }
}

/**
 * Extract a zip file to a target directory
 *
 * @param zipPath - Path to the zip file
 * @param targetDir - Target directory to extract to
 */
export async function extractZip(zipPath: string, targetDir: string): Promise<void> {
  if (!(await pathExists(zipPath))) {
    throw new Error(`Zip file not found: ${zipPath}`)
  }

  // Clear and create target directory
  await emptyDir(targetDir)
  const targetRoot = path.resolve(targetDir)

  const entryWrites: Promise<void>[] = []
  const unzip = new Unzip((file) => {
    const entryPath = resolveZipEntryPath(targetRoot, file.name)
    if (file.name.endsWith('/')) {
      mkdirSync(entryPath, { recursive: true })
      return
    }

    mkdirSync(path.dirname(entryPath), { recursive: true })
    entryWrites.push(writeZipEntry(file, entryPath))
  })
  unzip.register(UnzipInflate)

  for await (const chunk of createReadStream(zipPath)) {
    unzip.push(chunk as Buffer, false)
  }
  unzip.push(new Uint8Array(0), true)

  await Promise.all(entryWrites)
}

/** Collects relative posix file names and empty directories for zipping. */
async function collectZipEntries(
  rootDir: string
): Promise<{ files: string[]; emptyDirs: string[] }> {
  const dirents = await readdir(rootDir, { recursive: true, withFileTypes: true })

  const files: string[] = []
  const directories = new Set<string>()
  const populatedDirectories = new Set<string>()

  for (const dirent of dirents) {
    const relativeName = toPosixRelative(rootDir, path.join(dirent.parentPath, dirent.name))
    populatedDirectories.add(toPosixRelative(rootDir, dirent.parentPath))
    if (dirent.isDirectory()) {
      directories.add(relativeName)
    } else if (dirent.isFile()) {
      files.push(relativeName)
    }
  }

  return {
    files: files.toSorted(),
    emptyDirs: [...directories].filter((name) => !populatedDirectories.has(name)).toSorted()
  }
}

function toPosixRelative(rootDir: string, targetPath: string): string {
  return path.relative(rootDir, targetPath).split(path.sep).join('/')
}

/** Resolves an archive entry name inside the target root, rejecting escapes. */
function resolveZipEntryPath(rootDir: string, entryName: string): string {
  const resolved = path.resolve(rootDir, entryName.replaceAll('\\', '/'))
  if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) {
    throw new Error(`Zip entry escapes the target directory: ${entryName}`)
  }
  return resolved
}

function writeZipEntry(file: UnzipFile, entryPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(entryPath)
    output.once('error', reject)
    output.once('close', resolve)

    file.ondata = (error, chunk, final) => {
      if (error) {
        output.destroy(error)
        return
      }
      output.write(chunk)
      if (final) {
        output.end()
      }
    }
    file.start()
  })
}
