import rawLog from 'electron-log/renderer'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export function createLogger(prefix: string): Logger {
  assertSinglePrefix(prefix)

  return {
    debug: (message, ...args) => writeLog('debug', prefix, message, args),
    info: (message, ...args) => writeLog('info', prefix, message, args),
    warn: (message, ...args) => writeLog('warn', prefix, message, args),
    error: (message, ...args) => writeLog('error', prefix, message, args)
  }
}

function writeLog(
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
      processType: 'renderer',
      kisakiLogSource: 'renderer'
    }
  })
}

function assertSinglePrefix(prefix: string): void {
  if (!prefix || prefix.includes('.') || prefix.includes('[') || prefix.includes(']')) {
    throw new Error('Logger prefix must be a non-empty single segment.')
  }
}
