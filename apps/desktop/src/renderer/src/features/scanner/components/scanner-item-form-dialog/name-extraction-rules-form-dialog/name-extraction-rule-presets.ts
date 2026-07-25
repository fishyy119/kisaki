/**
 * Name extraction presets (renderer-only UI helpers).
 *
 * These presets are only used by the renderer preset picker dialog.
 * Names and descriptions resolve from the active message catalog.
 */

import { messages } from '@renderer/core/i18n'
import type { Messages } from '@shared/i18n'

export interface NameExtractionPreset {
  id: string
  name: string
  description: string
  pattern: string
}

type PresetCopyKey = keyof Messages['scanner']['rules']['presets']

const PRESET_DEFINITIONS: { id: string; copyKey: PresetCopyKey; pattern: string }[] = [
  { id: 'bracket-prefix', copyKey: 'bracketPrefix', pattern: '^\\[.*?\\]\\s*(?<name>.+)' },
  { id: 'paren-prefix', copyKey: 'parenPrefix', pattern: '^\\(.*?\\)\\s*(?<name>.+)' },
  {
    id: 'multi-bracket-prefix',
    copyKey: 'multiBracketPrefix',
    pattern: '^(?:\\[.*?\\]\\s*)+(?<name>.+)'
  },
  { id: 'bracket-suffix', copyKey: 'bracketSuffix', pattern: '^(?<name>.+?)\\s*\\[.*?\\]$' },
  { id: 'paren-suffix', copyKey: 'parenSuffix', pattern: '^(?<name>.+?)\\s*\\(.*?\\)$' },
  { id: 'version-suffix', copyKey: 'versionSuffix', pattern: '^(?<name>.+?)_v[\\d.]+' },
  { id: 'year-suffix', copyKey: 'yearSuffix', pattern: '^(?<name>.+?)\\s*\\(\\d{4}\\)$' },
  {
    id: 'lang-suffix',
    copyKey: 'langSuffix',
    pattern: '^(?<name>.+?)[-_](?:CHS|CHT|JP|EN|KR|SC|TC)(?:[-_]|$)'
  },
  {
    id: 'bracket-both',
    copyKey: 'bracketBoth',
    pattern: '^\\[.*?\\]\\s*(?<name>.+?)\\s*\\[.*?\\]$'
  }
]

export function getNameExtractionPresets(): NameExtractionPreset[] {
  const presetCopy = messages.value.scanner.rules.presets
  return PRESET_DEFINITIONS.map((definition) => ({
    id: definition.id,
    pattern: definition.pattern,
    name: presetCopy[definition.copyKey].name,
    description: presetCopy[definition.copyKey].description
  }))
}
