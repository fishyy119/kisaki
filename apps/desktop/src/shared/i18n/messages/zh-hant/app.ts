import type { Messages } from '../schema'

export const app = {
  quit: '結束 Kisaki',
  notFound: {
    title: '找不到頁面',
    description: '您造訪的頁面不存在。',
    backToLibrary: '返回資料庫'
  },
  error: {
    title: '應用程式錯誤',
    description: '抱歉，應用程式發生錯誤。',
    messageLabel: '錯誤訊息',
    stackLabel: '堆疊追蹤',
    reload: '重新載入應用程式'
  },
  about: {
    title: '關於 Kisaki',
    tagline1: 'Kisaki 是一個 ACGN 庫管理器，',
    tagline2: '旨在提供一個統一的使用者介面和資料庫模型，',
    tagline3: '來記錄、管理、建立、同步、展示您的媒體館藏與回憶。',
    authorLabel: '作者',
    authorName: 'ximu',
    repoLabel: '儲存庫',
    repoLink: 'GitHub 儲存庫',
    feedbackLabel: '意見回饋',
    feedbackLink: 'GitHub Issues',
    communityLabel: '群組',
    telegramGroup: 'Telegram 群組',
    versionLabel: '版本',
    checkUpdates: '檢查更新',
    readVersionFailed: '讀取版本失敗'
  }
} satisfies Messages['app']
