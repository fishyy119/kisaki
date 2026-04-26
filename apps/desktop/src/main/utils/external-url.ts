import { shell } from 'electron'

const EXTERNAL_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])
const BLOCKED_EXTERNAL_PROTOCOLS = new Set(['file:', 'javascript:', 'data:', 'vbscript:'])

interface ExternalProtocolOptions {
  readonly allowedProtocols?: ReadonlySet<string>
  readonly allowCustomProtocols?: boolean
}

export function isExternalLinkUrl(value: unknown): value is string {
  try {
    parseExternalLinkUrl(value)
    return true
  } catch {
    return false
  }
}

export async function openExternalLink(value: unknown): Promise<void> {
  await shell.openExternal(parseExternalLinkUrl(value).toString())
}

export async function openExternalProtocol(
  value: unknown,
  options: ExternalProtocolOptions = {}
): Promise<void> {
  await shell.openExternal(parseExternalProtocolUrl(value, options).toString())
}

function parseExternalLinkUrl(value: unknown): URL {
  return parseExternalProtocolUrl(value, { allowedProtocols: EXTERNAL_LINK_PROTOCOLS })
}

function parseExternalProtocolUrl(value: unknown, options: ExternalProtocolOptions): URL {
  const url = parseUrl(value)

  if (options.allowedProtocols?.has(url.protocol)) {
    return url
  }

  if (options.allowCustomProtocols && !BLOCKED_EXTERNAL_PROTOCOLS.has(url.protocol)) {
    return url
  }

  throw new Error(`External link protocol "${url.protocol}" is not allowed.`)
}

function parseUrl(value: unknown): URL {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('External link URL must be a non-empty string.')
  }

  return new URL(value)
}
