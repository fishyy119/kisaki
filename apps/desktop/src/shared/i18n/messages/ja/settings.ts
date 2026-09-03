import type { Messages } from '../schema'

export const settings = {
  title: '設定',
  sections: {
    appearance: '外観',
    window: '起動とウィンドウ',
    updates: '更新'
  },
  themeLabel: 'テーマ',
  themeModeLabel: '配色モード',
  interfaceScaleLabel: '表示倍率',
  interfaceScaleValue: ({ scale }: { scale: number }) => `${scale}%`,
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
