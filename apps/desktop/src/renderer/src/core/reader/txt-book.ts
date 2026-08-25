/**
 * Plain-text volume adapter for the foliate view.
 *
 * foliate's `makeBook` has no TXT branch, so TXT files become a book object
 * here: chapters are detected from CJK and western heading lines, oversized
 * runs fall back to fixed-size sections, and each section renders as a plain
 * HTML document of paragraphs.
 */

interface TxtSection {
  title: string
  text: string
}

/** CJK and western chapter headings on their own line. */
const HEADING_PATTERN =
  /^(?:第\s*[0-9〇零一二三四五六七八九十百千万]+\s*[章卷回话話节節部篇集]|(?:chapter|part|book)\s+\d+|prologue|epilogue|序章|终章|終章|尾声|尾聲|后记|後記|番外.*)\s*.{0,40}$/i

/** Sections beyond this size split so the paginator never lays out megabytes at once. */
const MAX_SECTION_CHARS = 65_536

export function makeTxtBook(text: string, title: string): object {
  const sections = splitSections(normalizeNewlines(text), title)
  const urls: string[] = []

  const load = (section: TxtSection) => {
    const html = renderSectionHtml(section)
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    urls.push(url)
    return url
  }

  const ids = sections.map((_, index) => `section-${index}`)

  return {
    metadata: { title },
    sections: sections.map((section, index) => ({
      id: ids[index],
      load: () => load(section),
      size: section.text.length
    })),
    toc: sections.map((section, index) => ({ label: section.title, href: ids[index] })),
    resolveHref: (href: string) => ({ index: ids.indexOf(href) }),
    splitTOCHref: (href: string) => [href, null],
    getTOCFragment: (doc: Document) => doc.documentElement,
    destroy: () => {
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }
}

function normalizeNewlines(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

function splitSections(text: string, fallbackTitle: string): TxtSection[] {
  const lines = text.split('\n')
  const sections: TxtSection[] = []
  let currentTitle = fallbackTitle
  let currentLines: string[] = []

  const flush = () => {
    const body = currentLines.join('\n').trim()
    if (body.length === 0 && sections.length > 0) return
    for (const chunk of chunkText(body)) {
      sections.push({ title: currentTitle, text: chunk })
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length > 0 && trimmed.length <= 64 && HEADING_PATTERN.test(trimmed)) {
      flush()
      currentTitle = trimmed
      currentLines = [trimmed]
    } else {
      currentLines.push(line)
    }
  }
  flush()

  return sections.length > 0 ? sections : [{ title: fallbackTitle, text: '' }]
}

/** Splits at paragraph boundaries so a cut never lands inside a sentence. */
function chunkText(text: string): string[] {
  if (text.length <= MAX_SECTION_CHARS) return [text]

  const paragraphs = text.split(/\n{2,}/)
  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    if (current.length + paragraph.length > MAX_SECTION_CHARS && current.length > 0) {
      chunks.push(current)
      current = paragraph
    } else {
      current = current.length > 0 ? `${current}\n\n${paragraph}` : paragraph
    }
  }
  if (current.length > 0) chunks.push(current)

  return chunks
}

function renderSectionHtml(section: TxtSection): string {
  const paragraphs = section.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('\n')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(section.title)}</title></head><body>${paragraphs}</body></html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
