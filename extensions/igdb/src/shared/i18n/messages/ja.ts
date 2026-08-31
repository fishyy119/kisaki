import type { IgdbMessages } from '../index'

export const ja: IgdbMessages = {
  errors: {
    credentialMissing:
      'IGDB 拡張設定で Twitch のクライアント ID とシークレットを先に登録してください',
    credentialInvalid:
      'Twitch がクライアント認証情報を拒否しました。IGDB 拡張設定で確認してください。',
    credentialRequired: 'クライアント ID とクライアントシークレットの両方を入力してください',
    notFound: 'その IGDB エントリは存在しません',
    rateLimited: 'IGDB へのリクエストが多すぎます。しばらくしてから再試行してください。',
    rejected: 'IGDB API がリクエストを拒否しました',
    unavailable: 'IGDB API は一時的に利用できません',
    networkFailed: 'IGDB API のネットワークリクエストに失敗しました',
    operationCancelled: '操作はキャンセルされました',
    baseUrlInvalid: 'http または https のアドレスを入力してください',
    idInvalid: ({ value }) => `「${value}」は有効な IGDB ID ではありません`
  },

  settings: {
    webviewTitle: 'IGDB',
    commandLabel: '設定',
    commandDescription: 'IGDB が認証に使う Twitch クライアントとエンドポイントを構成します'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'IGDB の設定を読み込めませんでした',
    savePreferences: '保存',
    discardChanges: '破棄',
    unsavedChanges: '未保存の変更',
    actionFailed: '操作に失敗しました',
    cancel: 'キャンセル',
    confirm: '確認',

    credentials: {
      title: 'Twitch クライアント',
      description:
        'IGDB は Twitch を通じて認証します。Twitch 開発者コンソールでアプリケーションを登録し、クライアント ID とシークレットを入力してください。',
      statusLabel: 'ステータス',
      clientIdLabel: 'クライアント ID',
      clientIdPlaceholder: 'Twitch のクライアント ID',
      clientSecretLabel: 'クライアントシークレット',
      clientSecretPlaceholder: 'Twitch のクライアントシークレット',
      configuredLabel: '設定済み',
      missingLabel: '未設定',
      save: 'クライアントを保存',
      clear: 'クライアントを削除',
      test: '接続テスト',
      testSucceeded: 'Twitch はクライアント認証情報を受け入れました',
      openConsole: 'dev.twitch.tv でアプリケーションを登録'
    },

    endpoints: {
      title: 'エンドポイント',
      description: '公式ホストに接続できない場合はミラーを指定します',
      apiBaseUrlLabel: 'API ベース URL',
      apiBaseUrlDescription: 'IGDB v4 API のルート',
      oauthUrlLabel: 'OAuth トークン URL',
      oauthUrlDescription: 'クライアント認証情報トークンを発行する Twitch エンドポイント',
      restoreDefaults: '公式エンドポイントに戻す'
    },

    preferences: {
      title: '設定',
      description: 'すべての IGDB 検索とスクレイピングに適用されます',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回の IGDB レスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      reset: '既定の設定に戻す',
      resetDescription:
        'エンドポイントと設定が既定値に戻ります。Twitch クライアントは保持されます。'
    }
  }
}
