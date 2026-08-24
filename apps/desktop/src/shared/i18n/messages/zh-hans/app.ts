import type { Messages } from '../schema'

export const app = {
  quit: '退出 Kisaki',
  notFound: {
    title: '页面未找到',
    description: '您访问的页面不存在',
    backToLibrary: '返回媒体库'
  },
  error: {
    title: '应用程序错误',
    description: '抱歉，应用程序遇到了一个错误',
    messageLabel: '错误信息',
    stackLabel: '堆栈跟踪',
    reload: '重新加载应用'
  },
  about: {
    title: '关于 Kisaki',
    tagline1: 'Kisaki 是一个 ACGN 库管理器，',
    tagline2: '旨在提供一个统一的用户界面和数据库模型，',
    tagline3: '来记录、管理、构建、同步、展示您的媒体馆藏与回忆',
    authorLabel: '作者',
    authorName: 'ximu',
    repoLabel: '仓库',
    repoLink: 'GitHub 仓库',
    feedbackLabel: '反馈',
    feedbackLink: 'GitHub Issues',
    communityLabel: '群组',
    telegramGroup: 'Telegram 群组',
    versionLabel: '版本',
    checkUpdates: '检查更新',
    readVersionFailed: '读取版本失败'
  }
} satisfies Messages['app']
