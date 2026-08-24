import type { TmdbMessages } from '../index'

export const ja: TmdbMessages = {
  errors: {
    apiKeyMissing: '先に TMDB 拡張機能の設定で API キーを入力してください',
    apiKeyInvalid: 'TMDB が API キーを拒否しました。TMDB 拡張機能の設定を確認してください。',
    apiKeyRequired: 'TMDB の API キーを入力してください',
    notFound: 'その TMDB エントリは存在しません',
    rateLimited: 'TMDB へのリクエストが多すぎます。しばらくしてからやり直してください。',
    rejected: 'TMDB API がリクエストを拒否しました',
    unavailable: 'TMDB API は一時的に利用できません',
    networkFailed: 'TMDB API へのネットワークリクエストに失敗しました',
    operationCancelled: '操作はキャンセルされました',
    baseUrlInvalid: 'http または https のアドレスを入力してください',
    idInvalid: ({ value }) => `「${value}」は TMDB の id ではありません`,
    referenceInvalid: ({ value }) =>
      `「${value}」は TMDB の参照ではありません。movie:<id>、tv:<id>、tv:<id>:s<シーズン>、tv:<id>:eg:<エピソードグループ id>:<グループ id>、または themoviedb.org のリンクを使用してください。`,
    episodeGroupEmpty: ({ setId }) =>
      `TMDB エピソードグループ ${setId} にはグループが含まれていません`,
    episodeGroupMissing: ({ setId, groupId }) =>
      `TMDB エピソードグループ ${setId} にグループ ${groupId} はありません`
  },

  settings: {
    webviewTitle: 'TMDB',
    commandLabel: '設定',
    commandDescription: 'TMDB の API キー、エンドポイント、スクレイピング設定を構成します'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'TMDB の設定を読み込めませんでした',
    saved: '設定を保存しました',
    savePreferences: '保存',
    discardChanges: '破棄',
    unsavedChanges: '未保存の変更があります',
    actionFailed: '操作に失敗しました',
    cancel: 'キャンセル',
    confirm: '確認',

    credentials: {
      title: 'API キー',
      description:
        'TMDB には個人キーが必要です。v3 API キーと v4 読み取りトークンのどちらも使用できます。',
      statusLabel: '状態',
      inputLabel: 'キーまたはトークン',
      inputPlaceholder: 'TMDB のキーを貼り付け',
      configuredLabel: '設定済み',
      missingLabel: '未設定',
      modeApiKey: 'v3 API キー',
      modeBearer: 'v4 読み取りトークン',
      save: 'キーを保存',
      clear: 'キーを削除',
      test: '接続テスト',
      saveSucceeded: 'API キーを保存しました',
      clearSucceeded: 'API キーを削除しました',
      testSucceeded: 'TMDB は API キーを受け入れました',
      openSettings: 'themoviedb.org でキーを取得'
    },

    endpoints: {
      title: 'エンドポイント',
      description: '公式ホストに接続できない場合はミラーを指定します',
      apiBaseUrlLabel: 'API ベース URL',
      apiBaseUrlDescription: 'TMDB v3 REST API のルート',
      imageBaseUrlLabel: '画像ベース URL',
      imageBaseUrlDescription: 'サイズ区分を含まない TMDB 画像 CDN のルート',
      restoreDefaults: '公式エンドポイントに戻す'
    },

    episodeGroups: {
      title: 'エピソードグループ',
      description:
        'エピソードグループは、TMDB のコミュニティが作品ごとに管理する別の話数構成です。たとえば長期シリーズの通し番号があります。既定は放送シーズンで、グループはエントリ単位で選びます。',
      stepPaste:
        'アニメの検索欄に作品 id、エピソードグループ id、または themoviedb.org のリンクを貼り付けて検索します',
      stepPick:
        '検索結果にその作品の全シーズンと、各エピソードグループの全グループが並びます。エントリが従うグループを選びます。',
      stepSwitch:
        '別のグループへ移すのは再スクレイピングだけです。各話は TMDB の episode id で再び対応づくため、変わるのは話数だけで視聴状態は保たれます。',
      inputsLabel: '検索欄で使える入力',
      idsLabel: 'グループが分かっている場合に id 欄で使える入力'
    },

    preferences: {
      title: '設定',
      description: 'すべての TMDB 検索とスクレイピングに適用されます',
      includeAdultLabel: 'アダルト結果を含める',
      includeAdultDescription: 'アダルトとして分類されたエントリも検索結果に含めます',
      timeoutLabel: 'リクエストのタイムアウト',
      timeoutDescription: 'TMDB の応答を待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      reset: '既定の設定に戻す',
      resetDescription: 'エンドポイントと設定は既定値に戻ります。API キーは保持されます。',
      resetSucceeded: '既定の設定に戻しました'
    }
  }
}
