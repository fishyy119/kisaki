import type { Messages } from '../schema'

export const nav = {
  library: '媒体库',
  statistics: '统计',
  scanner: '扫描器',
  automation: '自动化',
  extension: '扩展',
  settings: '设置',
  themeMode: '主题模式',
  themeLight: '浅色',
  themeDark: '深色',
  themeSystem: '跟随系统',
  showNsfw: '显示 NSFW 内容',
  scraperProfiles: '刮削配置',
  appSettings: '软件设置',
  about: '关于',
  nsfw: {
    enableTitle: '显示 NSFW 内容？',
    disableTitle: '隐藏 NSFW 内容？',
    enableDescription: '开启后将显示被标记为 NSFW 的内容。',
    disableDescription: '关闭后将隐藏被标记为 NSFW 的内容。'
  }
} satisfies Messages['nav']
