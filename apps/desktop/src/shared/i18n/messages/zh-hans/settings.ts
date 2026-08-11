import type { Messages } from '../schema'

export const settings = {
  title: '设置',
  themeLabel: '主题',
  autoLaunchLabel: '开机自启',
  closeActionLabel: '关闭窗口时',
  closeActionExit: '退出应用',
  closeActionTray: '最小化到托盘',
  updaterAutoCheckLabel: '自动检查更新',
  updaterAllowPrereleaseLabel: '接收预览版更新',
  loadFailed: '设置加载失败。',
  player: {
    audioLanguagesLabel: '首选音轨语言',
    subtitleLanguagesLabel: '首选字幕语言',
    languagesPlaceholder: '例如：jpn, eng',
    languagesHint: '用逗号分隔的语言标签，越靠前优先级越高。'
  },
  language: {
    followSystem: '跟随系统',
    uiLanguageLabel: '界面语言'
  }
} satisfies Messages['settings']
