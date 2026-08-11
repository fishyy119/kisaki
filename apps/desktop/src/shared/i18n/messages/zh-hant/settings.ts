import type { Messages } from '../schema'

export const settings = {
  title: '設定',
  themeLabel: '主題',
  autoLaunchLabel: '開機自動啟動',
  closeActionLabel: '關閉視窗時',
  closeActionExit: '結束應用程式',
  closeActionTray: '最小化到系統匣',
  updaterAutoCheckLabel: '自動檢查更新',
  updaterAllowPrereleaseLabel: '接收預覽版更新',
  loadFailed: '設定載入失敗。',
  player: {
    audioLanguagesLabel: '首選音軌語言',
    subtitleLanguagesLabel: '首選字幕語言',
    languagesPlaceholder: '例如：jpn, eng',
    languagesHint: '以逗號分隔的語言標籤，越靠前優先度越高。'
  },
  language: {
    followSystem: '跟隨系統',
    uiLanguageLabel: '介面語言'
  }
} satisfies Messages['settings']
