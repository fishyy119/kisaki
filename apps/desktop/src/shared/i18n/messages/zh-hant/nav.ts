import type { Messages } from '../schema'

export const nav = {
  library: '資料庫',
  statistics: '統計',
  scanner: '掃描器',
  automation: '自動化',
  extension: '擴充功能',
  settings: '設定',
  themeMode: '主題模式',
  themeLight: '淺色',
  themeDark: '深色',
  themeSystem: '跟隨系統',
  showNsfw: '顯示 NSFW 內容',
  scraperProfiles: '刮削設定',
  appSettings: '軟體設定',
  about: '關於',
  nsfw: {
    enableTitle: '顯示 NSFW 內容？',
    disableTitle: '隱藏 NSFW 內容？',
    enableDescription: '開啟後將顯示被標記為 NSFW 的內容',
    disableDescription: '關閉後將隱藏被標記為 NSFW 的內容'
  }
} satisfies Messages['nav']
