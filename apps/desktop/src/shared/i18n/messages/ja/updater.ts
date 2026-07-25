import type { Messages } from '../schema'

export const updater = {
  updateDownloaded: '更新をダウンロード済み',
  newVersionFound: ({ version }: { version: string }) => `新しいバージョン v${version} があります`,
  updateAvailable: '利用可能な更新があります',

  dialog: {
    title: 'アプリの更新',
    checking: '更新を確認しています…',
    downloading: '更新をダウンロードしています…',
    idleHint: '「更新を確認」を押して開始します。',
    newVersionAvailable: '新しいバージョンがあります',
    downloaded: '更新をダウンロード済み',
    upToDate: '現在最新のバージョンです。',
    failed: '更新に失敗しました',
    failedWithReason: ({ message }: { message: string }) => `更新に失敗しました：${message}`,
    releasedAt: ({ date }: { date: string }) => `${date} リリース`,
    checkFailed: '更新を確認できませんでした',
    downloadFailed: '更新をダウンロードできませんでした',
    installFailed: '更新をインストールできませんでした',
    changelogLoadFailed: '更新履歴を取得できませんでした',
    downloadProgress: 'ダウンロードの進行状況',
    changelogLabel: '更新履歴',
    changelogLoading: '更新履歴を読み込んでいます…',
    changelogError: ({ message }: { message: string }) =>
      `更新履歴を読み込めませんでした：${message}`,
    changelogEmpty: 'この言語の更新履歴はまだありません。',
    changelogPlaceholder: '更新が見つかるとここに更新履歴が表示されます。',
    checkUpdates: '更新を確認',
    startDownload: 'ダウンロード',
    installAndRestart: '更新して再起動'
  },

  run: {
    checkTitle: 'アプリの更新を確認',
    downloadTitle: ({ version }: { version: string }) => `アプリ更新 v${version} をダウンロード`,
    checkingPhase: 'アプリの更新を確認しています',
    downloadingPhase: 'アプリの更新をダウンロードしています',
    foundTitle: '新しいバージョンが見つかりました',
    foundSummary: ({ version }: { version: string }) => `アプリ更新 v${version} が利用可能です。`,
    upToDateTitle: '最新バージョンです',
    upToDateSummary: '利用可能なアプリ更新は見つかりませんでした。',
    checkCancelledSummary: 'アプリ更新の確認はキャンセルされました。',
    downloadedTitle: 'アプリ更新のダウンロードが完了しました',
    downloadedSummary: ({ version }: { version: string }) =>
      `アプリ更新 v${version} をダウンロードしました。`,
    downloadedSummaryNoVersion: 'アプリ更新をダウンロードしました。',
    downloadCancelledSummary: 'アプリ更新のダウンロードはキャンセルされました。'
  }
} satisfies Messages['updater']
