/**
 * Text decoding for plain-text volumes.
 *
 * A TXT file carries no charset declaration, and CJK web novels circulate in
 * legacy encodings far more often than in UTF-8. Decoding therefore sniffs:
 * a byte-order mark is authoritative, otherwise each candidate is decoded in
 * fatal mode and the first one that survives wins, with UTF-8 tried first.
 */

/** Legacy encodings a CJK text file realistically uses, in likelihood order. */
const CANDIDATE_ENCODINGS = ['utf-8', 'gb18030', 'big5', 'shift_jis', 'euc-kr'] as const

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

  for (const encoding of CANDIDATE_ENCODINGS) {
    const decoded = tryDecode(bytes, encoding)
    if (decoded !== null) return decoded
  }

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
