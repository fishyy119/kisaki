import type { Messages } from '../schema'

/**
 * Deeplink outcomes: feedback for external `kisaki://` links that fail before
 * any owning flow exists (invalid or unmatched links), extension route
 * availability, and unknown `open` destinations.
 */
export const deeplink = {
  invalidLinkTitle: '無効なリンク',
  invalidLinkMessage: 'このリンクを読み取れませんでした。',
  unknownLinkTitle: '不明なリンク',
  unknownLinkMessage: 'このリンクに対応する操作がありません。',
  extensionUnavailableTitle: '拡張機能リンクを処理できませんでした',
  extensionUnavailableMessage:
    'このリンクの拡張機能はインストールされていないか、実行されていません。',
  unknownDestinationTitle: '不明な移動先',
  unknownDestinationMessage: 'このリンクが指すページは、このバージョンの Kisaki にはありません。'
} satisfies Messages['deeplink']
