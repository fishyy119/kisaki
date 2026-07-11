import { app } from 'electron'
import path from 'node:path'
import rawLog from 'electron-log/main'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogSource = 'main' | 'renderer'

export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

let configured = false
let initialized = false

export function configureLogger(): void {
  if (configured) {
    return
  }

  rawLog.transports.file.resolvePathFn = (_variables, message) => {
    return path.join(app.getPath('userData'), 'logs', getLogFileName(getLogSource(message)))
  }

  configured = true
}

export function initializeLogger(): void {
  if (initialized) {
    return
  }

  configureLogger()
  rawLog.initialize()
  initialized = true
}

export function createLogger(prefix: string): Logger {
  assertSinglePrefix(prefix)

  return {
    debug: (message, ...args) => writeLog('main', 'debug', prefix, message, args),
    info: (message, ...args) => writeLog('main', 'info', prefix, message, args),
    warn: (message, ...args) => writeLog('main', 'warn', prefix, message, args),
    error: (message, ...args) => writeLog('main', 'error', prefix, message, args)
  }
}

function writeLog(
  source: LogSource,
  level: LogLevel,
  prefix: string,
  message: string,
  args: readonly unknown[]
): void {
  rawLog.processMessage({
    date: new Date(),
    level,
    data: [`[${prefix}] ${message}`, ...args],
    variables: {
      processType: source,
      kisakiLogSource: source
    }
  })
}

function getLogSource(message?: { variables?: Record<string, unknown> }): LogSource {
  const source = message?.variables?.kisakiLogSource
  if (source === 'main' || source === 'renderer') {
    return source
  }
  return 'main'
}

function getLogFileName(source: LogSource): string {
  switch (source) {
    case 'renderer':
      return 'renderer.log'
    default:
      return 'main.log'
  }
}

function assertSinglePrefix(prefix: string): void {
  if (!prefix || prefix.includes('.') || prefix.includes('[') || prefix.includes(']')) {
    throw new Error('Logger prefix must be a non-empty single segment.')
  }
}
