import type { GbooksMessages } from '../index'

export const ja: GbooksMessages = {
  errors: {
    authRequired: 'まず Google アカウントにサインインしてください',
    tokenExpired: 'Google のサインインが期限切れです。再度サインインしてください。',
    notFound: 'その Google Books ボリュームは存在しません',
    rateLimited:
      'Google Books の検索クォータを使い切りました。個人の API キーを追加するか、後で再試行してください。',
    rejected: 'Google Books API がリクエストを拒否しました',
    unavailable: 'Google Books API は一時的に利用できません',
    networkFailed: 'Google Books へのネットワークリクエストに失敗しました',
    relayUnavailable: 'Kisaki OAuth リレーは一時的に利用できません。後でもう一度お試しください。',
    loginSessionExpired:
      'Google サインインセッションの有効期限が切れました。再度サインインしてください。',
    loginCallbackInvalid:
      'Google サインインのコールバック検証に失敗しました。再度サインインしてください。',
    noPendingLogin: '完了待ちの Google サインインはありません',
    loginNotReady: 'Google サインインはまだ準備できていません',
    operationCancelled: '操作はキャンセルされました',
    baseUrlInvalid: 'http または https のアドレスを入力してください',
    idInvalid: ({ value }) => `「${value}」は有効な Google Books ボリューム ID ではありません`,
    keyEmpty: 'API キーを入力してください',
    operationRunning: 'Google Books のインポートが既に実行中です。完了までお待ちください。'
  },

  oauth: {
    loginSucceededTitle: 'Google サインインが完了しました',
    loginFailedTitle: 'Google サインインに失敗しました',
    loginCompleted: 'Google Books ライブラリが接続されました',
    callbackFailed: 'Google サインインを完了できませんでした'
  },

  import: {
    taskTitle: 'Google Books ライブラリをインポート',
    phaseRead: 'Google Books の本棚を読み込み中',
    phaseApply: 'エントリを適用中',
    itemFailed: ({ id }) => `${id} のインポートに失敗しました`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `作成 ${created} 件、更新 ${updated} 件、変更なし ${unchanged} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  settings: {
    webviewTitle: 'Google Books',
    commandLabel: '設定',
    commandDescription:
      'Google Books へのサインイン、ライブラリのインポート、スクレイピング設定を行います'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'Google Books の設定を読み込めませんでした',
    saved: '設定を保存しました',
    savePreferences: '保存',
    discardChanges: '破棄',
    unsavedChanges: '未保存の変更',
    actionFailed: '操作に失敗しました',
    cancel: 'キャンセル',
    confirm: '確認',

    account: {
      title: 'アカウント',
      description:
        'ブラウザからサインインして Google Books ライブラリと連携します。検索はサインイン不要です。個人の API キーは任意で、検索クォータを引き上げます。',
      statusLabel: 'ステータス',
      configuredLabel: 'サインイン済み',
      missingLabel: '未サインイン',
      pendingLabel: 'ブラウザでのサインインを待機中…',
      login: 'Google でサインイン',
      completeLogin: '認可を完了しました',
      cancelLogin: 'サインインをキャンセル',
      logout: 'サインアウト',
      apiKeyLabel: 'API キー(任意)',
      apiKeyDescription: '検索クォータを引き上げます。Google Cloud コンソールで作成できます',
      apiKeyPlaceholder: 'API キーを貼り付け',
      apiKeyConfigured: 'API キー保存済み',
      saveKey: 'キーを保存',
      clearKey: 'キーを削除'
    },

    integration: {
      title: 'ライブラリのインポート',
      description:
        '購入済みライブラリと読書シェルフを読み込み、一致するエントリへステータスを書き込み、不足エントリは選択したプロファイルで作成します。Google Books が扱うのは購入であり追跡ではないため、書き戻しは行いません。',
      includeEbooksLabel: 'マイ Google eBooks',
      includeEbooksDescription:
        '購入・アップロード済みのライブラリ。ステータスなしでインポートされます',
      includeShelvesLabel: '読書シェルフ',
      includeShelvesDescription: '読みたい・読書中・読了がエントリのステータスになります',
      updateExistingLabel: '既存エントリを更新',
      createMissingLabel: '不足エントリを作成',
      mergeSeriesLabel: 'シリーズの巻をまとめる',
      mergeSeriesDescription: '同一シリーズの複数巻は最初の巻のみでエントリを作成します',
      novelProfileLabel: 'ノベルプロファイル',
      comicProfileLabel: 'コミックプロファイル',
      profilePlaceholder: 'プロファイルを選択',
      startImport: 'インポート',
      taskProgress: ({ current, total }) => `${current} / ${total}`,
      taskRunning: '実行中',
      taskCompleted: '完了',
      taskFailed: '失敗',
      taskCancelled: 'キャンセル済み',
      cancelTask: 'キャンセル'
    },

    endpoints: {
      title: 'エンドポイント',
      description: 'Google サインインは Kisaki リレーで完了します',
      relayUrlLabel: 'OAuth リレー URL',
      relayUrlDescription: 'Kisaki リレー上の Google Books ルートのルート URL',
      restoreDefaults: '既定のリレーに戻す'
    },

    preferences: {
      title: '設定',
      description: 'すべての Google Books リクエストに適用されます',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回のレスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      reset: '既定の設定に戻す',
      resetDescription: 'エンドポイントと設定が既定値に戻ります。サインインは保持されます。',
      resetSucceeded: '既定の設定に戻しました'
    }
  }
}
