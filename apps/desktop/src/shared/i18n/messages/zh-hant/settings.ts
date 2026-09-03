import type { Messages } from '../schema'

export const settings = {
  title: '設定',
  sections: {
    appearance: '外觀',
    window: '啟動與視窗',
    updates: '更新'
  },
  themeLabel: '主題',
  themeModeLabel: '明暗模式',
  interfaceScaleLabel: '介面縮放',
  interfaceScaleValue: ({ scale }: { scale: number }) => `${scale}%`,
  autoLaunchLabel: '開機自動啟動',
  closeActionLabel: '關閉視窗時',
  closeActionExit: '結束應用程式',
  closeActionTray: '最小化到系統匣',
  updaterAutoCheckLabel: '自動檢查更新',
  updaterAllowPrereleaseLabel: '接收預覽版更新',
  loadFailed: '設定載入失敗',
  language: {
    followSystem: '跟隨系統',
    uiLanguageLabel: '介面語言'
  }
} satisfies Messages['settings']
