import type { SgdbMessages } from '../index'

export const ja: SgdbMessages = {
  errors: {
    keyRequired: 'まず SteamGridDB API キーを保存してください',
    keyRejected: 'SteamGridDB が API キーを拒否しました',
    notFound: 'その SteamGridDB エントリは存在しません',
    rateLimited: 'SteamGridDB へのリクエストが多すぎます。しばらくしてから再試行してください。',
    rejected: 'SteamGridDB API がリクエストを拒否しました',
    unavailable: 'SteamGridDB API は一時的に利用できません',
    networkFailed: 'SteamGridDB へのネットワークリクエストに失敗しました',
    operationCancelled: '操作はキャンセルされました',
    idInvalid: ({ value }) => `「${value}」は有効な SteamGridDB ID ではありません`,
    keyEmpty: 'API キーを入力してください'
  },

  settings: {
    webviewTitle: 'SteamGridDB',
    commandLabel: '設定',
    commandDescription: 'SteamGridDB の API キーとアートワーク設定を行います'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'SteamGridDB の設定を読み込めませんでした',
    saved: '設定を保存しました',
    savePreferences: '保存',
    discardChanges: '破棄',
    unsavedChanges: '未保存の変更',
    actionFailed: '操作に失敗しました',
    cancel: 'キャンセル',
    confirm: '確認',

    account: {
      title: 'API キー',
      description:
        'SteamGridDB には無料の個人 API キーが必要です。保存時にプローブリクエストで検証します。',
      statusLabel: 'ステータス',
      configuredLabel: 'キー保存済み',
      missingLabel: 'キー未保存',
      keyLabel: 'API キー',
      keyPlaceholder: 'API キーを貼り付け',
      saveKey: 'キーを保存',
      clearKey: 'キーを削除',
      openKeyPage: 'API キーを取得'
    },

    preferences: {
      title: '設定',
      description: 'すべてのアートワークリクエストに適用されます',
      includeNsfwLabel: 'NSFW アートを含める',
      includeNsfwDescription: 'コミュニティが NSFW とマークしたアートも返します',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回のレスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      reset: '既定の設定に戻す',
      resetDescription: '設定が既定値に戻ります。保存済みのキーは保持されます。',
      resetSucceeded: '既定の設定に戻しました'
    }
  }
}
