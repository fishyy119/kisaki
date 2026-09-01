import type { Messages } from '../schema'

/**
 * Deeplink outcomes: feedback for external `kisaki://` links that fail before
 * any owning flow exists (invalid or unmatched links), extension route
 * availability, and unknown `open` destinations.
 */
export const deeplink = {
  invalidLinkTitle: '链接无效',
  invalidLinkMessage: '无法读取这个链接。',
  unknownLinkTitle: '无法识别的链接',
  unknownLinkMessage: '没有能处理这个链接的操作。',
  extensionUnavailableTitle: '扩展链接处理失败',
  extensionUnavailableMessage: '这个链接对应的扩展未安装或未在运行。',
  unknownDestinationTitle: '未知的目的地',
  unknownDestinationMessage: '这个链接指向的页面在当前版本中不存在。'
} satisfies Messages['deeplink']
