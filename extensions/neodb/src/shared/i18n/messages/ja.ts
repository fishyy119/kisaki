import type { NeodbMessages } from '../index'

export const ja: NeodbMessages = {
  errors: {
    authRequired: 'まず NeoDB アカウントにサインインしてください',
    tokenRejected: 'NeoDB のサインインが無効になりました。再度サインインしてください。',
    notFound: 'その NeoDB エントリは存在しません',
    rateLimited: 'NeoDB へのリクエストが多すぎます。しばらくしてから再試行してください。',
    rejected: 'NeoDB API がリクエストを拒否しました',
    unavailable: 'NeoDB インスタンスは一時的に利用できません',
    networkFailed: 'NeoDB へのネットワークリクエストに失敗しました',
    operationCancelled: '操作はキャンセルされました',
    instanceUrlInvalid: 'http または https のアドレスを入力してください',
    idInvalid: ({ value }) => `「${value}」は有効な NeoDB ID ではありません`,
    registrationFailed: 'アプリはこのインスタンスに自己登録できませんでした',
    loginStateMismatch:
      'NeoDB サインインのコールバック検証に失敗しました。再度サインインしてください。',
    loginSessionExpired:
      'NeoDB サインインセッションの有効期限が切れました。再度サインインしてください。',
    noPendingLogin: '完了待ちの NeoDB サインインはありません',
    loginNotReady: 'NeoDB サインインはまだ準備できていません',
    codeEmpty: '認可コードを入力してください',
    operationRunning: 'NeoDB 本棚の操作が既に実行中です。完了までお待ちください。'
  },

  oauth: {
    loginSucceededTitle: 'NeoDB サインインが完了しました',
    loginFailedTitle: 'NeoDB サインインに失敗しました',
    loginCompleted: ({ userName }) => `${userName} としてサインインしました`,
    callbackFailed: 'NeoDB サインインを完了できませんでした'
  },

  sync: {
    autoSyncFailedTitle: 'NeoDB 同期に失敗しました',
    autoSyncFailedFallback: '変更を NeoDB に送信できませんでした',
    pushTaskTitle: 'ライブラリを NeoDB の本棚へ送信',
    pushSummary: ({ pushed, skipped, failed }) =>
      `送信 ${pushed} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  import: {
    taskTitle: 'NeoDB の本棚をインポート',
    phaseRead: 'NeoDB の本棚を読み込み中',
    phaseApply: '本棚のエントリを適用中',
    itemFailed: ({ id }) => `${id} のインポートに失敗しました`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `作成 ${created} 件、更新 ${updated} 件、変更なし ${unchanged} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  settings: {
    webviewTitle: 'NeoDB',
    commandLabel: '設定',
    commandDescription:
      'NeoDB インスタンスへのサインイン、本棚のインポート、スクレイピング設定を行います'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'NeoDB の設定を読み込めませんでした',
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
        'アプリは選択したインスタンスに自己登録し、ブラウザでサインインします。サインインに期限はありません。ブラウザがアプリに戻れない場合は認可コード方式を使ってください。',
      statusLabel: 'ステータス',
      configuredLabel: 'サインイン済み',
      missingLabel: '未サインイン',
      pendingLabel: 'ブラウザでのサインインを待機中…',
      manualPendingLabel: '認可コードの入力を待機中…',
      instanceLabel: ({ instanceUrl }) => `インスタンス: ${instanceUrl}`,
      login: 'ブラウザでサインイン',
      manualLogin: '認可コードでサインイン',
      codePlaceholder: '認可コードを貼り付け',
      completeManual: 'サインインを完了',
      cancelLogin: 'サインインをキャンセル',
      logout: 'サインアウト',
      verify: 'アカウントを確認',
      verifiedAs: ({ userName }) => `${userName} としてサインイン中`
    },

    integration: {
      title: '本棚連携',
      syncEnabledLabel: '変更を自動送信',
      syncEnabledDescription: 'NeoDB ID を持つエントリのステータスとスコアの変更を本棚へ送信します',
      pushScoreLabel: 'スコアを含める',
      pushScoreDescription:
        'ローカルスコアを本棚の評価として書き込みます。スコアが空でも消去はされません。',
      visibilityLabel: 'マークの公開範囲',
      visibilityDescription: 'このアプリが書き込むマークのフェディバース公開範囲',
      visibilityPublic: '公開',
      visibilityFollowers: 'フォロワーのみ',
      visibilitySelf: '自分のみ',
      pushAll: '今すぐ全件送信',
      importTitle: '本棚をインポート',
      importDescription:
        '本棚のステータスと評価を一致するエントリへ書き込みます。不足エントリの作成は選択したプロファイルでスクレイピングします。',
      updateExistingLabel: '既存エントリを更新',
      createMissingLabel: '不足エントリを作成',
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
      title: 'インスタンス',
      description: '任意の NeoDB デプロイで動作します。サインインはそのインスタンスに紐付きます。',
      instanceUrlLabel: 'インスタンス URL',
      instanceUrlDescription: 'NeoDB インスタンスのルート',
      restoreDefaults: 'フラッグシップインスタンスに戻す'
    },

    preferences: {
      title: '設定',
      description: 'すべての NeoDB リクエストに適用されます',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回のレスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      reset: '既定の設定に戻す',
      resetDescription: 'インスタンスと設定が既定値に戻ります。サインインは保持されます。',
      resetSucceeded: '既定の設定に戻しました'
    }
  }
}
