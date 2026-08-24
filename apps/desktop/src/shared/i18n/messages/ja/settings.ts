import type { Messages } from '../schema'

export const settings = {
  title: '設定',
  themeLabel: 'テーマ',
  autoLaunchLabel: '起動時に自動実行',
  closeActionLabel: 'ウィンドウを閉じたとき',
  closeActionExit: 'アプリを終了',
  closeActionTray: 'トレイに最小化',
  updaterAutoCheckLabel: '更新を自動的に確認',
  updaterAllowPrereleaseLabel: 'プレビュー版の更新を受け取る',
  loadFailed: '設定の読み込みに失敗しました',
  language: {
    followSystem: 'システムに従う',
    uiLanguageLabel: '表示言語'
  }
} satisfies Messages['settings']
