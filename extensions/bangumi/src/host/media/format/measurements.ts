import type { BangumiInfoboxItem, BangumiInfoboxValue } from '../../api/types'
import { normalizeToken } from './text'

type CharacterMeasurements = {
  height?: number | undefined
  weight?: number | undefined
  bust?: number | undefined
  waist?: number | undefined
  hips?: number | undefined
}

export function extractCharacterMeasurementsFromInfobox(
  infobox: BangumiInfoboxItem[] | null | undefined
): CharacterMeasurements {
  if (!infobox?.length) {
    return {}
  }

  let height: number | undefined
  let weight: number | undefined
  let bust: number | undefined
  let waist: number | undefined
  let hips: number | undefined

  for (const item of infobox) {
    const keyRaw = item.key?.trim() || ''
    if (!keyRaw) continue

    const keyLower = keyRaw.toLowerCase()
    const keyNormalized = normalizeToken(keyRaw)
    const keyCompact = keyRaw.replace(/\s+/g, '')
    const values = flattenInfoboxValues(item.value)
    if (values.length === 0) continue

    if (isHeightKey(keyLower, keyCompact, keyNormalized) && height === undefined) {
      height = parseFirst(values, parseHeightValue)
      continue
    }

    if (isWeightKey(keyLower, keyCompact, keyNormalized) && weight === undefined) {
      weight = parseFirst(values, parseWeightValue)
      continue
    }

    if (isBwhKey(keyCompact, keyNormalized)) {
      for (const value of values) {
        const parsed = parseBwhValue(value)
        if (bust === undefined && parsed.bust !== undefined) bust = parsed.bust
        if (waist === undefined && parsed.waist !== undefined) waist = parsed.waist
        if (hips === undefined && parsed.hips !== undefined) hips = parsed.hips
      }
      continue
    }

    if (isBustKey(keyLower, keyCompact, keyNormalized)) {
      const parsed = parseFirst(values, parseCircumferenceValue)
      if (parsed !== undefined) bust = parsed
      continue
    }

    if (isWaistKey(keyLower, keyCompact, keyNormalized)) {
      const parsed = parseFirst(values, parseCircumferenceValue)
      if (parsed !== undefined) waist = parsed
      continue
    }

    if (isHipsKey(keyLower, keyCompact, keyNormalized)) {
      const parsed = parseFirst(values, parseCircumferenceValue)
      if (parsed !== undefined) hips = parsed
    }
  }

  return { height, weight, bust, waist, hips }
}

function isHeightKey(lower: string, compact: string, normalized: string): boolean {
  return (
    normalized.includes('height') ||
    compact.includes('身高') ||
    compact.includes('身長') ||
    lower.includes('height')
  )
}

function isWeightKey(lower: string, compact: string, normalized: string): boolean {
  return (
    normalized.includes('weight') ||
    compact.includes('体重') ||
    compact.includes('體重') ||
    lower.includes('weight')
  )
}

function isBwhKey(compact: string, normalized: string): boolean {
  return (
    normalized === 'bwh' ||
    normalized.includes('bwh') ||
    compact.includes('三围') ||
    compact.includes('三圍')
  )
}

function isBustKey(lower: string, compact: string, normalized: string): boolean {
  return (
    normalized.includes('bust') ||
    compact.includes('胸围') ||
    compact.includes('胸圍') ||
    compact.includes('バスト') ||
    /\bbust\b/.test(lower)
  )
}

function isWaistKey(lower: string, compact: string, normalized: string): boolean {
  return (
    normalized.includes('waist') ||
    compact.includes('腰围') ||
    compact.includes('腰圍') ||
    compact.includes('ウエスト') ||
    /\bwaist\b/.test(lower)
  )
}

function isHipsKey(lower: string, compact: string, normalized: string): boolean {
  return (
    normalized.includes('hips') ||
    normalized === 'hip' ||
    compact.includes('臀围') ||
    compact.includes('臀圍') ||
    compact.includes('ヒップ') ||
    /\bhips?\b/.test(lower)
  )
}

function parseFirst(
  values: string[],
  parser: (value: string) => number | undefined
): number | undefined {
  for (const value of values) {
    const parsed = parser(value)
    if (parsed !== undefined) {
      return parsed
    }
  }
  return undefined
}

function parseBwhValue(value: string): Pick<CharacterMeasurements, 'bust' | 'waist' | 'hips'> {
  const normalized = normalizeMeasurementText(value)

  const bust = parseCircumferenceValue(
    getCapture(normalized, /(?:^|[^a-z])b\s*([0-9]+(?:\.[0-9]+)?)/i)
  )
  const waist = parseCircumferenceValue(
    getCapture(normalized, /(?:^|[^a-z])w\s*([0-9]+(?:\.[0-9]+)?)/i)
  )
  const hips = parseCircumferenceValue(
    getCapture(normalized, /(?:^|[^a-z])h\s*([0-9]+(?:\.[0-9]+)?)/i)
  )

  if (bust !== undefined || waist !== undefined || hips !== undefined) {
    return { bust, waist, hips }
  }

  const numbers = extractNumericValues(normalized)
  if (numbers.length >= 3) {
    return {
      bust: clampMeasurement(numbers[0], 40, 180),
      waist: clampMeasurement(numbers[1], 30, 150),
      hips: clampMeasurement(numbers[2], 40, 180)
    }
  }

  return {}
}

function parseHeightValue(value: string): number | undefined {
  const normalized = normalizeMeasurementText(value).toLowerCase()

  const cmValue = getCapture(normalized, /([0-9]+(?:\.[0-9]+)?)\s*(?:cm|厘米|公分|センチ|㎝)\b/i)
  if (cmValue) {
    return clampMeasurement(Number(cmValue), 30, 300)
  }

  const meterValue = getCapture(normalized, /([0-9]+(?:\.[0-9]+)?)\s*m\b/i)
  if (meterValue) {
    return clampMeasurement(Number(meterValue) * 100, 30, 300)
  }

  const first = extractNumericValues(normalized)[0]
  return clampMeasurement(first, 30, 300)
}

function parseWeightValue(value: string): number | undefined {
  const normalized = normalizeMeasurementText(value).toLowerCase()

  const kgValue = getCapture(normalized, /([0-9]+(?:\.[0-9]+)?)\s*(?:kg|公斤|千克|㎏)\b/i)
  if (kgValue) {
    return clampMeasurement(Number(kgValue), 10, 500)
  }

  const lbValue = getCapture(normalized, /([0-9]+(?:\.[0-9]+)?)\s*(?:lb|lbs|磅)\b/i)
  if (lbValue) {
    return clampMeasurement(Number(lbValue) * 0.45359237, 10, 500)
  }

  const first = extractNumericValues(normalized)[0]
  return clampMeasurement(first, 10, 500)
}

function parseCircumferenceValue(value: string | undefined): number | undefined {
  if (!value) return undefined
  const normalized = normalizeMeasurementText(value).toLowerCase()

  const cmValue = getCapture(normalized, /([0-9]+(?:\.[0-9]+)?)\s*(?:cm|厘米|公分|センチ|㎝)\b/i)
  if (cmValue) {
    return clampMeasurement(Number(cmValue), 20, 200)
  }

  const first = extractNumericValues(normalized)[0]
  return clampMeasurement(first, 20, 200)
}

function extractNumericValues(value: string): number[] {
  const matches = value.match(/[0-9]+(?:\.[0-9]+)?/g)
  if (!matches) return []
  return matches
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry > 0)
}

function normalizeMeasurementText(value: string): string {
  return value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[．]/g, '.')
    .replace(/[／]/g, '/')
    .replace(/[，]/g, ',')
    .replace(/[－—–～〜]/g, '-')
    .trim()
}

function getCapture(value: string, regex: RegExp): string | undefined {
  const match = value.match(regex)
  const captured = match?.[1]?.trim()
  return captured || undefined
}

function clampMeasurement(value: number | undefined, min: number, max: number): number | undefined {
  if (!Number.isFinite(value as number)) return undefined
  const parsed = value as number
  if (parsed < min || parsed > max) return undefined

  const rounded = Math.round(parsed * 10) / 10
  return Number.isInteger(rounded) ? Math.trunc(rounded) : rounded
}

function flattenInfoboxValues(value: string | BangumiInfoboxValue[]): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value.map((entry) => entry.v?.trim()).filter((entry): entry is string => !!entry)
}
