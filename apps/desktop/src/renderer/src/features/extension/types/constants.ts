/**
 * Extension Constants
 *
 * Runtime constants for extension system.
 * Category labels resolve from the active message catalog.
 */

import { computed } from 'vue'
import { messages } from '@renderer/core/i18n'
import type { ExtensionCategory } from '@kisaki3/extension-api'

/**
 * All available extension categories with display metadata.
 */
export const EXTENSION_CATEGORIES = computed<
  ReadonlyArray<{ id: ExtensionCategory; label: string; icon: string }>
>(() => [
  { id: 'scraper', label: messages.value.extension.categories.scraper, icon: 'DatabaseSearch' },
  { id: 'tool', label: messages.value.extension.categories.tool, icon: 'Wrench' },
  { id: 'theme', label: messages.value.extension.categories.theme, icon: 'Palette' },
  { id: 'integration', label: messages.value.extension.categories.integration, icon: 'Cable' }
])
