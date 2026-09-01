import type { Messages } from '../schema'

/**
 * Deeplink outcomes: feedback for external `kisaki://` links that fail before
 * any owning flow exists (invalid or unmatched links), extension route
 * availability, and unknown `open` destinations.
 */
export const deeplink = {
  invalidLinkTitle: '連結無效',
  invalidLinkMessage: '無法讀取這個連結。',
  unknownLinkTitle: '無法識別的連結',
  unknownLinkMessage: '沒有能處理這個連結的操作。',
  extensionUnavailableTitle: '擴充功能連結處理失敗',
  extensionUnavailableMessage: '這個連結對應的擴充功能未安裝或未在執行。',
  unknownDestinationTitle: '未知的目的地',
  unknownDestinationMessage: '這個連結指向的頁面在目前版本中不存在。'
} satisfies Messages['deeplink']
