/**
 * Reading surface of a text volume: the typography the reader chooses and the
 * two places it has to be applied.
 *
 * A book's own stylesheet governs its interior, so reader preferences reach it
 * as an injected sheet, while column count and text measure are layout facts
 * the paginator owns as attributes. Both are derived from one settings shape so
 * a preference can never be applied to only half of the surface.
 */

/** Page tint of the reading surface. */
export type ReaderPageTint = 'theme' | 'paper' | 'sepia'

/** Reading font presets; each is a CSS family list with CJK fallbacks. */
export type ReaderFontPreset = 'book' | 'serif' | 'sans'

export interface ReaderTypography {
  /** CSS family list; empty keeps the book's own fonts. */
  fontFamily: string
  fontSizePercent: number
  lineHeight: number
  /** Space after a paragraph, in em. */
  paragraphSpacing: number
  /** Maximum width of one text column, in px. */
  textWidth: number
  justify: boolean
  /** Columns a wide window may split the text into. */
  columns: number
  tint: ReaderPageTint
}

export interface ReaderPageColors {
  background: string
  foreground: string
}

export const READER_FONT_FAMILIES: Record<ReaderFontPreset, string> = {
  book: '',
  serif:
    "Georgia, 'Times New Roman', 'Source Han Serif SC', 'Noto Serif CJK SC', 'Songti SC', 'Yu Mincho', 'MS Mincho', serif",
  sans: "'Segoe UI', system-ui, 'Source Han Sans SC', 'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', 'Yu Gothic', sans-serif"
}

export const READER_TYPOGRAPHY_RANGES = {
  fontSizePercent: { min: 75, max: 200, step: 5 },
  lineHeight: { min: 1.2, max: 2.4, step: 0.1 },
  paragraphSpacing: { min: 0, max: 2, step: 0.25 },
  textWidth: { min: 480, max: 1280, step: 40 },
  columns: { min: 1, max: 2, step: 1 }
} as const

export const DEFAULT_READER_TYPOGRAPHY: ReaderTypography = {
  fontFamily: '',
  fontSizePercent: 100,
  lineHeight: 1.6,
  paragraphSpacing: 0.5,
  textWidth: 720,
  justify: false,
  columns: 2,
  tint: 'theme'
}

/**
 * Fixed reading surfaces, stable whichever app theme is active. The `theme`
 * tint follows the app's own tokens instead, so it is resolved from the
 * document rather than listed here.
 */
export const READER_PAGE_TINTS: Record<Exclude<ReaderPageTint, 'theme'>, ReaderPageColors> = {
  paper: { background: '#faf6ee', foreground: '#33302b' },
  sepia: { background: '#f0e4cd', foreground: '#4a3f30' }
}

/** Colors of the reading surface, for both the book interior and its margins. */
function resolvePageColors(tint: ReaderPageTint): ReaderPageColors {
  if (tint !== 'theme') return READER_PAGE_TINTS[tint]

  const rootStyles = getComputedStyle(document.documentElement)
  return {
    background: rootStyles.getPropertyValue('--color-background').trim() || '#ffffff',
    foreground: rootStyles.getPropertyValue('--color-foreground').trim() || '#111111'
  }
}

/** Content styles injected into a book's own document. */
export function buildNovelContentStyles(typography: ReaderTypography): string {
  const { background, foreground } = resolvePageColors(typography.tint)
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-primary')
    .trim()

  return `
    @namespace epub "http://www.idpf.org/2007/ops";
    html {
      background: ${background};
      color: ${foreground};
      font-size: ${typography.fontSizePercent}%;
      ${typography.fontFamily ? `font-family: ${typography.fontFamily};` : ''}
    }
    ${typography.fontFamily ? `body, p, li, blockquote, dd { font-family: inherit; }` : ''}
    a:link, a:visited {
      color: ${accent || '#3b82f6'};
    }
    p, li, blockquote, dd {
      line-height: ${typography.lineHeight};
      text-align: ${typography.justify ? 'justify' : 'start'};
      widows: 2;
      orphans: 2;
    }
    p {
      margin-block-end: ${typography.paragraphSpacing}em;
    }
  `
}

/**
 * Applies the layout half of the typography to the paginator element.
 *
 * Vertical writing modes read the inline size along the other axis, so the
 * paginator resolves the measure itself; only the values it observes are set.
 */
export function applyNovelLayout(renderer: HTMLElement, typography: ReaderTypography): void {
  renderer.setAttribute('max-inline-size', `${typography.textWidth}px`)
  renderer.setAttribute('max-column-count', String(typography.columns))
}
