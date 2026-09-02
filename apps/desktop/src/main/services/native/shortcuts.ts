/**
 * Native shortcuts: writes an OS launcher file that opens a URL, in the form
 * each platform treats as a first-class shortcut.
 *
 * URL shortcuts (rather than links to the executable) survive the application
 * moving or updating, because the URL scheme is re-registered on every start.
 * Windows writes `.url`, Linux writes `.desktop`, macOS writes `.webloc` — the
 * last has no custom-icon slot, so the icon argument is ignored there.
 *
 * Knows nothing about what the URL means; callers pass a display name, the URL,
 * and optionally an icon file the platform can point at.
 */

import { app } from 'electron'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isLinux, isMacOS, isWindows } from '@main/env'
import { createLogger } from '@main/log'

const log = createLogger('Native')

/** Where a shortcut may be written; the service resolves the OS path. */
export type ShortcutLocation = 'desktop'

export interface UrlShortcutInput {
  location: ShortcutLocation
  /** Display name; sanitized into the file name. */
  baseName: string
  url: string
  /** Absolute path of an icon in the platform's native format (ico / png). */
  iconPath?: string
  description?: string
}

export interface UrlShortcutResult {
  /** Absolute path of the written shortcut file. */
  path: string
  /** Whether the platform honoured the requested icon. */
  iconApplied: boolean
}

const MAX_BASE_NAME_LENGTH = 120

export class NativeShortcuts {
  async createUrlShortcut(input: UrlShortcutInput): Promise<UrlShortcutResult> {
    const directory = resolveLocation(input.location)
    await mkdir(directory, { recursive: true })

    const baseName = sanitizeFileBaseName(input.baseName)
    const { fileName, content, iconApplied, executable } = renderShortcut(baseName, input)
    const filePath = path.join(directory, fileName)

    try {
      await writeFile(filePath, content, 'utf8')
      if (executable) {
        await chmod(filePath, 0o755)
      }
    } catch (error) {
      log.error('Failed to write shortcut file.', error, { fileName })
      throw new Error('Failed to write the shortcut file.', { cause: error })
    }

    log.info('Shortcut written.', { fileName, location: input.location, iconApplied })
    return { path: filePath, iconApplied }
  }
}

function resolveLocation(location: ShortcutLocation): string {
  switch (location) {
    case 'desktop':
      return app.getPath('desktop')
  }
}

interface RenderedShortcut {
  fileName: string
  content: string
  iconApplied: boolean
  executable: boolean
}

function renderShortcut(baseName: string, input: UrlShortcutInput): RenderedShortcut {
  if (isWindows) {
    return renderWindowsUrlFile(baseName, input)
  }
  if (isLinux) {
    return renderDesktopEntry(baseName, input)
  }
  if (isMacOS) {
    return renderWebloc(baseName, input)
  }
  throw new Error(`Shortcuts are not supported on platform: ${process.platform}`)
}

/** `.url` INI: the shell resolves the scheme, `IconFile` points at an ico or exe. */
function renderWindowsUrlFile(baseName: string, input: UrlShortcutInput): RenderedShortcut {
  const lines = ['[InternetShortcut]', `URL=${input.url}`]
  if (input.iconPath) {
    lines.push(`IconFile=${input.iconPath}`, 'IconIndex=0')
  }
  return {
    fileName: `${baseName}.url`,
    content: `${lines.join('\r\n')}\r\n`,
    iconApplied: Boolean(input.iconPath),
    executable: false
  }
}

/** freedesktop `.desktop` entry; `xdg-open` hands the URL to the scheme handler. */
function renderDesktopEntry(baseName: string, input: UrlShortcutInput): RenderedShortcut {
  const lines = [
    '[Desktop Entry]',
    'Version=1.0',
    'Type=Application',
    `Name=${escapeDesktopValue(input.baseName)}`,
    `Exec=xdg-open ${quoteShellSingle(input.url)}`,
    'Terminal=false'
  ]
  if (input.description) {
    lines.push(`Comment=${escapeDesktopValue(input.description)}`)
  }
  if (input.iconPath) {
    lines.push(`Icon=${input.iconPath}`)
  }
  return {
    fileName: `${baseName}.desktop`,
    content: `${lines.join('\n')}\n`,
    iconApplied: Boolean(input.iconPath),
    executable: true
  }
}

/** `.webloc` plist; Finder gives it a generic icon, so the request is not honoured. */
function renderWebloc(baseName: string, input: UrlShortcutInput): RenderedShortcut {
  const content = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '\t<key>URL</key>',
    `\t<string>${escapeXml(input.url)}</string>`,
    '</dict>',
    '</plist>',
    ''
  ].join('\n')
  return { fileName: `${baseName}.webloc`, content, iconApplied: false, executable: false }
}

/**
 * Reduces a display name to a file base name every platform accepts:
 * reserved characters, control characters, and trailing dots/spaces go, and
 * the length is bounded so the full path stays under platform limits.
 */
function sanitizeFileBaseName(name: string): string {
  const cleaned = Array.from(name, (char) => (isFileNameSafe(char) ? char : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, MAX_BASE_NAME_LENGTH)
    .trim()
  return cleaned.length > 0 ? cleaned : 'Shortcut'
}

const RESERVED_FILE_NAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])

/** Reserved path characters and C0 control characters are not safe in any file name. */
function isFileNameSafe(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return code >= 0x20 && !RESERVED_FILE_NAME_CHARS.has(char)
}

function escapeDesktopValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, ' ')
}

function quoteShellSingle(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
