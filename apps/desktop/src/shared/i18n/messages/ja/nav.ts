import type { Messages } from '../schema'

export const nav = {
  library: 'ライブラリ',
  statistics: '統計',
  scanner: 'スキャナー',
  automation: '自動化',
  extension: '拡張機能',
  settings: '設定',
  themeMode: 'テーマモード',
  themeLight: 'ライト',
  themeDark: 'ダーク',
  themeSystem: 'システムに従う',
  showNsfw: 'NSFW コンテンツを表示',
  scraperProfiles: 'スクレイパー設定',
  appSettings: 'アプリ設定',
  about: 'このアプリについて',
  nsfw: {
    enableTitle: 'NSFW コンテンツを表示しますか？',
    disableTitle: 'NSFW コンテンツを隠しますか？',
    enableDescription: '有効にすると、NSFW としてマークされたコンテンツが表示されます',
    disableDescription: '無効にすると、NSFW としてマークされたコンテンツが非表示になります'
  }
} satisfies Messages['nav']
