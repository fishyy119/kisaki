import type { Messages } from '../schema'

export const settings = {
  title: '设置',
  sections: {
    appearance: '外观',
    window: '启动与窗口',
    updates: '更新'
  },
  themeLabel: '主题',
  themeModeLabel: '明暗模式',
  interfaceScaleLabel: '界面缩放',
  interfaceScaleValue: ({ scale }: { scale: number }) => `${scale}%`,
  autoLaunchLabel: '开机自启',
  closeActionLabel: '关闭窗口时',
  closeActionExit: '退出应用',
  closeActionTray: '最小化到托盘',
  updaterAutoCheckLabel: '自动检查更新',
  updaterAllowPrereleaseLabel: '接收预览版更新',
  loadFailed: '设置加载失败',
  language: {
    followSystem: '跟随系统',
    uiLanguageLabel: '界面语言'
  }
} satisfies Messages['settings']
