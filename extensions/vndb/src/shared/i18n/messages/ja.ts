import type { VndbMessages } from '../index'

export const ja: VndbMessages = {
  errors: {
    tokenInvalid: 'VNDB が API トークンを拒否しました。VNDB 拡張設定で確認してください。',
    tokenRequired: 'VNDB の API トークンを入力してください',
    notFound: 'その VNDB エントリは存在しません',
    rateLimited: 'VNDB へのリクエストが多すぎます。しばらくしてから再試行してください。',
    rejected: 'VNDB API がリクエストを拒否しました',
    unavailable: 'VNDB API は一時的に利用できません',
    networkFailed: 'VNDB API のネットワークリクエストに失敗しました',
    operationCancelled: '操作はキャンセルされました',
    baseUrlInvalid: 'http または https のアドレスを入力してください',
    idInvalid: ({ value }) => `「${value}」は有効な VNDB ID ではありません`
  },

  settings: {
    webviewTitle: 'VNDB',
    commandLabel: '設定',
    commandDescription: '任意の VNDB API トークン、エンドポイント、スクレイピング設定を構成します'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'VNDB の設定を読み込めませんでした',
    saved: '設定を保存しました',
    savePreferences: '保存',
    discardChanges: '破棄',
    unsavedChanges: '未保存の変更',
    actionFailed: '操作に失敗しました',
    cancel: 'キャンセル',
    confirm: '確認',

    credentials: {
      title: 'API トークン',
      description:
        'Kana API は公開されているため、トークンなしでもスクレイピングできます。個人トークンを追加するとレート上限が上がります。',
      statusLabel: 'ステータス',
      inputLabel: 'トークン',
      inputPlaceholder: 'VNDB のトークンを貼り付け',
      configuredLabel: '設定済み',
      missingLabel: '匿名アクセス',
      save: 'トークンを保存',
      clear: 'トークンを削除',
      test: '接続テスト',
      saveSucceeded: 'API トークンを保存しました',
      clearSucceeded: 'API トークンを削除しました',
      testSucceeded: 'VNDB はリクエストを受け入れました',
      openSettings: 'vndb.org でトークンを作成'
    },

    endpoints: {
      title: 'エンドポイント',
      description: '公式ホストに接続できない場合はミラーを指定します',
      apiBaseUrlLabel: 'API ベース URL',
      apiBaseUrlDescription: 'VNDB Kana API のルート',
      restoreDefaults: '公式エンドポイントに戻す'
    },

    preferences: {
      title: '設定',
      description: 'すべての VNDB 検索とスクレイピングに適用されます',
      preferRomanizedLabel: 'ローマ字タイトルを優先',
      preferRomanizedDescription:
        'コンテンツ言語に対応するタイトルがない場合、ローマ字タイトルを表示名として使用します',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回の VNDB レスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      reset: '既定の設定に戻す',
      resetDescription: 'エンドポイントと設定が既定値に戻ります。トークンは保持されます。',
      resetSucceeded: '既定の設定に戻しました'
    }
  }
}
