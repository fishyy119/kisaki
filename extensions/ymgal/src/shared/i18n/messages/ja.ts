import type { YmgalMessages } from '../index'

export const ja: YmgalMessages = {
  errors: {
    authFailed: 'YMGal がクライアント認証情報を拒否しました。YMGal 拡張設定で確認してください。',
    credentialRequired: 'クライアント ID とクライアントシークレットの両方を入力してください',
    notFound: 'その YMGal アーカイブは存在しません',
    rateLimited: 'YMGal へのリクエストが多すぎます。しばらくしてから再試行してください。',
    rejected: 'YMGal API がリクエストを拒否しました',
    unavailable: 'YMGal API は一時的に利用できません',
    networkFailed: 'YMGal API のネットワークリクエストに失敗しました',
    operationCancelled: '操作はキャンセルされました',
    baseUrlInvalid: 'http または https のアドレスを入力してください',
    idInvalid: ({ value }) => `「${value}」は有効な YMGal アーカイブ ID ではありません`
  },

  settings: {
    webviewTitle: 'YMGal',
    commandLabel: '設定',
    commandDescription: 'YMGal API クライアント、エンドポイント、スクレイピング設定を構成します'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'YMGal の設定を読み込めませんでした',
    savePreferences: '保存',
    discardChanges: '破棄',
    unsavedChanges: '未保存の変更',
    actionFailed: '操作に失敗しました',
    cancel: 'キャンセル',
    confirm: '確認',

    credentials: {
      title: 'API クライアント',
      description:
        'YMGal は共有の公開クライアントを提供しており、本拡張は既定でそれを使用します。専用クライアントを申請した場合のみ入力してください。',
      statusLabel: '使用中のクライアント',
      sharedLabel: '共有の公開クライアント',
      customLabel: '専用クライアント',
      clientIdLabel: 'クライアント ID',
      clientIdPlaceholder: 'YMGal のクライアント ID',
      clientSecretLabel: 'クライアントシークレット',
      clientSecretPlaceholder: 'YMGal のクライアントシークレット',
      save: 'クライアントを保存',
      clear: '共有クライアントに戻す',
      test: '接続テスト',
      testSucceeded: 'YMGal は API クライアントを受け入れました',
      openDeveloper: 'ymgal.games でクライアントを申請'
    },

    endpoints: {
      title: 'エンドポイント',
      description: '公式ホストに接続できない場合はミラーを指定します',
      apiBaseUrlLabel: 'API ベース URL',
      apiBaseUrlDescription: 'YMGal オープン API のルート',
      restoreDefaults: '公式エンドポイントに戻す'
    },

    preferences: {
      title: '設定',
      description: 'すべての YMGal 検索とスクレイピングに適用されます',
      preferChineseLabel: '中国語タイトルを優先',
      preferChineseDescription: 'コンテンツ言語が中国語のとき、中国語名を表示名として使用します',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回の YMGal レスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      reset: '既定の設定に戻す',
      resetDescription: 'エンドポイントと設定が既定値に戻ります。クライアント情報は保持されます。'
    }
  }
}
