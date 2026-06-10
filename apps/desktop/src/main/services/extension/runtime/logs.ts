import path from 'node:path'
import fse from 'fs-extra'
import rawLog from 'electron-log/main'
import {
  createUnavailableError,
  type ExtensionRuntimeHandle,
  type ExtensionRuntimeMetadata,
  type RpcValue
} from '@kisaki3/extension-api'
import { resolveInsideRoot } from '../shared/path-confinement'

type ExtensionLogLevel = 'debug' | 'info' | 'warn' | 'error'

const EXTENSION_AUTHOR_LOG_PATH_VARIABLE = 'kisakiExtensionLogPath'
const extensionAuthorLog = rawLog.create({ logId: 'kisaki-extension-author' })

extensionAuthorLog.transports.file.resolvePathFn = (_variables, message) => {
  const logPath = message?.variables?.[EXTENSION_AUTHOR_LOG_PATH_VARIABLE]
  if (typeof logPath !== 'string' || logPath.length === 0) {
    throw new Error('Extension log path is missing.')
  }

  return logPath
}

export class ExtensionRuntimeLogs {
  constructor(
    private readonly resolveRuntimeHandle: (
      runtimeHandle: ExtensionRuntimeHandle
    ) => ExtensionRuntimeMetadata | null
  ) {}

  async write(
    runtimeHandle: ExtensionRuntimeHandle,
    level: ExtensionLogLevel,
    message: string,
    args: readonly RpcValue[],
    signal?: AbortSignal
  ): Promise<void> {
    const extension = this.requireRuntimeHandle(runtimeHandle)
    const logPath = this.getLogPath(extension)

    this.requireActiveRequest(runtimeHandle, logPath, signal)
    await fse.ensureDir(path.dirname(logPath))
    this.requireActiveRequest(runtimeHandle, logPath, signal)

    extensionAuthorLog.processMessage(
      {
        date: new Date(),
        level,
        data: [message, ...args],
        variables: {
          processType: 'main',
          [EXTENSION_AUTHOR_LOG_PATH_VARIABLE]: logPath
        }
      },
      { transports: ['file'] }
    )
  }

  private getLogPath(extension: ExtensionRuntimeMetadata): string {
    return resolveInsideRoot(extension.dataPath, 'logs', 'extension.log')
  }

  private requireRuntimeHandle(runtimeHandle: ExtensionRuntimeHandle): ExtensionRuntimeMetadata {
    const extension = this.resolveRuntimeHandle(runtimeHandle)
    if (!extension) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return extension
  }

  private requireActiveRequest(
    runtimeHandle: ExtensionRuntimeHandle,
    logPath: string,
    signal?: AbortSignal
  ): void {
    if (signal?.aborted) {
      throw createUnavailableError(`Log request for runtime handle "${runtimeHandle}" was aborted.`)
    }

    const extension = this.requireRuntimeHandle(runtimeHandle)
    if (this.getLogPath(extension) !== logPath) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" no longer owns its log path.`)
    }
  }
}
