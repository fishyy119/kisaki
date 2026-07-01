import type {
  ExtensionRegistryLocalizedDocument,
  ExtensionRegistryLocalizedDocumentSet
} from '@kisaki3/extension-registry'
import { getLocale } from '@renderer/core/i18n'

export function selectLocalizedDocument(
  documentSet: ExtensionRegistryLocalizedDocumentSet | null | undefined
): ExtensionRegistryLocalizedDocument | null {
  if (!documentSet) {
    return null
  }

  const documents = documentSet.locales
  const currentLocale = getLocale()
  const language = currentLocale.split('-')[0]
  const candidates = [currentLocale, language, documentSet.defaultLocale]

  for (const candidate of candidates) {
    const document = findDocumentByLocale(documents, candidate)
    if (document) {
      return document
    }
  }

  return Object.values(documents)[0] ?? null
}

export function getLocalizedSummary(
  documentSet: ExtensionRegistryLocalizedDocumentSet | null | undefined,
  fallback = ''
): string {
  return selectLocalizedDocument(documentSet)?.summary ?? fallback
}

export function getLocalizedBody(
  documentSet: ExtensionRegistryLocalizedDocumentSet | null | undefined
): string | null {
  return selectLocalizedDocument(documentSet)?.body ?? null
}

export function collectLocalizedDocumentText(
  documentSet: ExtensionRegistryLocalizedDocumentSet | null | undefined
): string {
  if (!documentSet) {
    return ''
  }

  return Object.values(documentSet.locales)
    .flatMap((document) => [document.summary, document.body ?? ''])
    .join('\n')
}

function findDocumentByLocale(
  documents: Readonly<Record<string, ExtensionRegistryLocalizedDocument>>,
  locale: string
): ExtensionRegistryLocalizedDocument | null {
  const exact = documents[locale]
  if (exact) {
    return exact
  }

  const normalized = locale.toLowerCase()
  const matchedLocale = Object.keys(documents).find((key) => key.toLowerCase() === normalized)
  return matchedLocale ? documents[matchedLocale] : null
}
