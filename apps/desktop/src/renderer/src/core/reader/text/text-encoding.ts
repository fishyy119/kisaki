/**
 * Text decoding for plain-text volumes.
 *
 * A TXT file carries no charset declaration, and CJK web novels circulate in
 * legacy encodings far more often than in UTF-8. A byte-order mark is
 * authoritative, and UTF-8 surviving a fatal decode is too — its structure
 * makes accidental survival of legacy CJK bytes practically impossible.
 *
 * The legacy encodings cannot be told apart that way: GB18030 maps nearly the
 * whole byte space, so Shift-JIS text "survives" it as plausible-looking
 * mojibake. Every surviving candidate is therefore scored on how much of it
 * reads as CJK prose — kana and CJK punctuation are the discriminators, since
 * a wrong decode almost never reproduces their natural density — and the best
 * reading wins.
 */

/** Legacy encodings a CJK text file realistically uses, in likelihood order. */
const LEGACY_ENCODINGS = ['gb18030', 'big5', 'shift_jis', 'euc-kr'] as const

/** Prose settles within this many characters; scoring more buys nothing. */
const SCORE_SAMPLE_CHARS = 4096

interface ByteOrderMark {
  encoding: string
  bytes: readonly number[]
}

const BYTE_ORDER_MARKS: readonly ByteOrderMark[] = [
  { encoding: 'utf-8', bytes: [0xef, 0xbb, 0xbf] },
  { encoding: 'utf-16le', bytes: [0xff, 0xfe] },
  { encoding: 'utf-16be', bytes: [0xfe, 0xff] }
]

export function decodeTextFile(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)

  const mark = BYTE_ORDER_MARKS.find((candidate) =>
    candidate.bytes.every((byte, index) => bytes[index] === byte)
  )
  if (mark) {
    return new TextDecoder(mark.encoding).decode(bytes)
  }

  const utf8 = tryDecode(bytes, 'utf-8')
  if (utf8 !== null) return utf8

  let best: string | null = null
  let bestScore = -Infinity
  for (const encoding of LEGACY_ENCODINGS) {
    const decoded = tryDecode(bytes, encoding)
    if (decoded === null) continue
    const score = scoreCjkProse(decoded)
    if (score > bestScore) {
      best = decoded
      bestScore = score
    }
  }
  if (best !== null) return best

  // Every candidate rejected the bytes: fall back to a lossy read so the
  // volume still opens, with replacement characters where they belong.
  return new TextDecoder('utf-8').decode(bytes)
}

function tryDecode(bytes: Uint8Array, encoding: string): string | null {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

/**
 * Average prose weight per sampled character.
 *
 * Kana and CJK punctuation weigh double: real Japanese is dense in kana and
 * every CJK sentence is dense in 、。「」, while a wrong legacy decode yields
 * bare ideograph soup without them. Private-use and control characters are
 * decoder debris and weigh heavily against.
 */
function scoreCjkProse(text: string): number {
  const sample = text.slice(0, SCORE_SAMPLE_CHARS)
  if (sample.length === 0) return 0

  let score = 0
  let sampled = 0
  for (const char of sample) {
    sampled += 1
    score += proseWeight(char.codePointAt(0) as number)
  }
  return score / sampled
}

function proseWeight(code: number): number {
  // Kana — the strongest signal that Japanese decoded as Japanese.
  if (code >= 0x3040 && code <= 0x30ff) return 2
  // CJK punctuation and fullwidth forms, dense in genuine prose.
  if (code >= 0x3000 && code <= 0x303f) return 2
  if (code >= 0xff00 && code <= 0xff60) return 2
  // CJK ideographs, including extension A and compatibility.
  if (code >= 0x4e00 && code <= 0x9fff) return 1
  if (code >= 0x3400 && code <= 0x4dbf) return 1
  if (code >= 0xf900 && code <= 0xfaff) return 1
  // Hangul syllables.
  if (code >= 0xac00 && code <= 0xd7af) return 1
  // ASCII and common Latin punctuation; identical in every candidate.
  if (code === 0x09 || code === 0x0a || code === 0x0d) return 1
  if (code >= 0x20 && code <= 0x7e) return 1
  // General punctuation (quotes, dashes, ellipsis).
  if (code >= 0x2000 && code <= 0x206f) return 1
  // Private use and stray controls are decoder debris.
  if (code >= 0xe000 && code <= 0xf8ff) return -5
  if (code === 0xfffd) return -5
  if (code < 0x20) return -3
  return 0
}
