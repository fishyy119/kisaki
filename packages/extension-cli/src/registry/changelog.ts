import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import type { ExtensionRegistryLocalizedDocumentSet } from '@kisaki3/extension-registry'
import { CliError } from '../errors'

const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const FRONT_MATTER_DELIMITER = '---'

export interface ReadRegistryReleaseChangelogOptions {
  directory: string
  defaultLocale: string
}

/** Reads a localized release changelog directory containing one <locale>.md file per locale. */
export function readRegistryReleaseChangelogDirectory(
  options: ReadRegistryReleaseChangelogOptions
): ExtensionRegistryLocalizedDocumentSet {
  const directory = path.resolve(options.directory)
  const defaultLocale = options.defaultLocale.trim()

  if (!defaultLocale) {
    throw new CliError('--default-locale must be a non-empty locale.')
  }
  if (!LOCALE_PATTERN.test(defaultLocale)) {
    throw new CliError('--default-locale must be a locale such as en or zh-Hans.')
  }
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    throw new CliError(`Changelog directory not found: ${directory}`)
  }

  const files = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  if (files.length === 0) {
    throw new CliError(
      `Changelog directory must contain at least one <locale>.md file: ${directory}`
    )
  }

  const locales: Record<string, ExtensionRegistryLocalizedDocumentSet['locales'][string]> = {}
  const seenLocales = new Set<string>()
  for (const file of files) {
    const locale = path.basename(file, '.md')
    const normalizedLocale = locale.toLowerCase()
    if (!LOCALE_PATTERN.test(locale)) {
      throw new CliError(`Changelog filename must be a locale such as en or zh-Hans: ${file}`)
    }
    if (seenLocales.has(normalizedLocale)) {
      throw new CliError(`Duplicate changelog locale: ${locale}`)
    }
    seenLocales.add(normalizedLocale)
    locales[locale] = readChangelogMarkdown(path.join(directory, file))
  }

  if (!Object.prototype.hasOwnProperty.call(locales, defaultLocale)) {
    throw new CliError(`--default-locale must match a changelog file in ${directory}.`)
  }

  return {
    defaultLocale,
    locales
  }
}

function readChangelogMarkdown(
  filePath: string
): ExtensionRegistryLocalizedDocumentSet['locales'][string] {
  const content = readFileSync(filePath, 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
  if (!content.trim()) {
    throw new CliError(`Changelog file is empty: ${filePath}`)
  }

  const { frontMatter, body } = parseMarkdownFrontMatter(content, filePath)
  const summary = readFrontMatterSummary(frontMatter, filePath)
  const normalizedBody = body.trim()
  return {
    summary,
    ...(normalizedBody ? { body: normalizedBody } : {})
  }
}

function parseMarkdownFrontMatter(
  content: string,
  filePath: string
): { frontMatter: string; body: string } {
  const lines = content.split('\n')
  if (lines[0]?.trim() !== FRONT_MATTER_DELIMITER) {
    throw new CliError(`Changelog file must start with front matter: ${filePath}`)
  }

  const endIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === FRONT_MATTER_DELIMITER
  )
  if (endIndex < 0) {
    throw new CliError(`Changelog front matter must end with ---: ${filePath}`)
  }

  return {
    frontMatter: lines.slice(1, endIndex).join('\n'),
    body: lines.slice(endIndex + 1).join('\n')
  }
}

function readFrontMatterSummary(frontMatter: string, filePath: string): string {
  const summaryLine = frontMatter.split('\n').find((line) => line.trim().startsWith('summary:'))
  if (summaryLine === undefined) {
    throw new CliError(`Changelog front matter must declare summary: ${filePath}`)
  }

  const separatorIndex = summaryLine.indexOf(':')
  const summary = parseFrontMatterString(summaryLine.slice(separatorIndex + 1))
  if (!summary) {
    throw new CliError(`Changelog summary is empty: ${filePath}`)
  }
  return summary
}

function parseFrontMatterString(value: string): string {
  const trimmed = value.trim()
  const quote = trimmed[0]
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}
