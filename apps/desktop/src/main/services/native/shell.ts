import { shell } from 'electron'
import { stat } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { createLogger } from '@main/log'
import { openExternalLink } from '@main/utils/external-url'

const log = createLogger('Native')

export class NativeShell {
  async openPath(
    input:
      | string
      | {
          path: string
          ensure?: 'auto' | 'folder' | 'file'
        }
  ): Promise<void> {
    const config =
      typeof input === 'string'
        ? { path: input, ensure: 'auto' as const }
        : { path: input.path, ensure: input.ensure ?? ('auto' as const) }

    let targetPath = config.path

    if (config.ensure === 'folder') {
      targetPath = await this.ensureFolderPath(targetPath)
    }

    try {
      const errorMessage = await shell.openPath(targetPath)
      if (errorMessage) {
        throw new Error('Shell openPath failed.')
      }
    } catch (error) {
      log.error('Failed to open native path.', error, {
        targetName: basename(targetPath),
        ensure: config.ensure
      })
      throw new Error('Failed to open native path.', { cause: error })
    }
  }

  async openExternal(url: string): Promise<void> {
    await openExternalLink(url)
  }

  private async ensureFolderPath(path: string): Promise<string> {
    try {
      const info = await stat(path)
      if (info.isDirectory()) return path
      if (info.isFile()) return dirname(path)
      return dirname(path)
    } catch {
      const candidate = dirname(path)
      try {
        const info = await stat(candidate)
        if (info.isDirectory()) return candidate
      } catch {
        // ignore
      }
      return candidate
    }
  }
}
