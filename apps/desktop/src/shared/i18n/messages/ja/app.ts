import type { Messages } from '../schema'

export const app = {
  quit: 'Kisaki を終了',
  notFound: {
    title: 'ページが見つかりません',
    description: 'アクセスしたページは存在しません。',
    backToLibrary: 'ライブラリに戻る'
  },
  error: {
    title: 'アプリケーションエラー',
    description: '申し訳ありません。アプリでエラーが発生しました。',
    messageLabel: 'エラーメッセージ',
    stackLabel: 'スタックトレース',
    reload: 'アプリを再読み込み'
  },
  about: {
    title: 'Kisaki について',
    tagline1: 'Kisaki は多機能なメディアライブラリマネージャーです。',
    tagline2: '一貫したインターフェースとデータモデルで、',
    tagline3: 'コレクションと思い出の記録・管理・構築・同期・展示を目指します。',
    authorLabel: '作者',
    authorName: 'ximu',
    repoLabel: 'リポジトリ',
    repoLink: 'GitHub リポジトリ',
    feedbackLabel: 'フィードバック',
    feedbackLink: 'GitHub Issues',
    communityLabel: 'コミュニティ',
    telegramGroup: 'Telegram グループ',
    versionLabel: 'バージョン',
    checkUpdates: '更新を確認',
    readVersionFailed: 'バージョンを読み取れませんでした'
  }
} satisfies Messages['app']
