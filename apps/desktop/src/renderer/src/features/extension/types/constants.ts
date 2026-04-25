/**
 * Extension Constants
 *
 * Runtime constants for extension system.
 */

import type { ExtensionCategory } from '@kisaki/extension-api'

/**
 * All available extension categories with display metadata.
 */
export const EXTENSION_CATEGORIES = [
  { id: 'scraper' as const, label: '元数据', icon: 'DatabaseSearch' },
  { id: 'tool' as const, label: '工具', icon: 'Wrench' },
  { id: 'theme' as const, label: '主题', icon: 'Palette' },
  { id: 'integration' as const, label: '集成', icon: 'Cable' }
] as const satisfies ReadonlyArray<{
  id: ExtensionCategory
  label: string
  icon: string
}>
