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

  commands: {
    verifyAccount: {
      title: 'NeoDB アカウントを確認',
      description: '保存済みサインインを NeoDB インスタンスに照会します'
    },
    pushAll: {
      title: 'ライブラリを NeoDB へ送信',
      description: 'NeoDB ID を持つすべてのエントリを本棚へ送信します'
    },
    importShelf: {
      title: 'NeoDB の本棚をインポート',
      description: '本棚のステータスと評価を一致するローカルエントリへ書き込みます'
    }
  },

  automations: {
    names: {
      'auth-check': 'NeoDB: 起動時にアカウントを確認',
      'push-full-daily': 'NeoDB: 毎日の全件送信',
      'import-refresh-weekly': 'NeoDB: 毎週の本棚更新'
    },
    labels: {
      'auth-check': '起動時にアカウントを確認',
      'push-full-daily': '毎日の全件送信',
      'import-refresh-weekly': '毎週の本棚更新'
    },
    descriptions: {
      'auth-check': 'アプリ起動時に NeoDB サインインを確認します',
      'push-full-daily': '毎日早朝に、関連付け済みの全エントリを NeoDB の本棚へ送信します',
      'import-refresh-weekly':
        '毎週、本棚のステータスと評価を既存エントリへ再インポートします'
    },
    status: {
      missing: '未作成',
      enabled: '有効',
      disabled: '無効'
    }
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

    tabs: {
      overview: '概要',
      account: 'アカウント',
      sync: '同期',
      import: 'インポート',
      automation: '自動化',
      maintenance: 'メンテナンス'
    },

    task: {
      progress: ({ current, total }) => `${current} / ${total}`,
      running: '実行中',
      completed: '完了',
      failed: '失敗',
      cancelled: 'キャンセル済み',
      cancel: 'キャンセル'
    },

    overview: {
      statusTitle: 'ステータス概要',
      accountLabel: 'アカウント',
      signedIn: 'サインイン済み',
      notSignedIn: '未サインイン',
      available: '利用可能',
      autoSyncLabel: '自動送信',
      enabled: '有効',
      disabled: '無効',
      withScore: 'ステータスと評価',
      withoutScore: 'ステータスのみ',
      recommendedAutomations: '推奨自動化',
      automationsComplete: 'すべて作成済み',
      automationsMissing: ({ count }) => `${count} 件未作成`,
      templatesCount: ({ count }) => `テンプレート ${count} 件`,
      runtimeTitle: '実行状況',
      runningJobs: '実行中の NeoDB タスク',
      running: '実行中',
      idle: '待機中',
      quickActionsTitle: 'ショートカット',
      importAction: 'NeoDB の本棚をインポート',
      maintenanceAction: 'インスタンスとクライアント設定を調整',
      automationsTitle: '自動化テンプレート'
    },

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

    sync: {
      preferencesTitle: '自動送信の設定',
      syncEnabledLabel: '変更を自動送信',
      syncEnabledDescription:
        'NeoDB ID を持つエントリのステータスとスコアの変更を本棚へ送信します',
      pushScoreLabel: 'スコアを含める',
      pushScoreDescription:
        'ローカルスコアを本棚の評価として書き込みます。スコアが空でも消去はされません。',
      visibilityLabel: 'マークの公開範囲',
      visibilityDescription: 'このアプリが書き込むマークのフェディバース公開範囲',
      visibilityPublic: '公開',
      visibilityFollowers: 'フォロワーのみ',
      visibilitySelf: '自分のみ',
      manualTitle: '手動送信',
      manualDescription:
        'NeoDB ID を持つすべてのエントリを本棚へ送信します。進行状況とキャンセルはタスクセンターが扱います。',
      pushAll: '今すぐ全件送信'
    },

    import: {
      title: '本棚をインポート',
      description:
        '本棚のステータスと評価を一致するエントリへ書き込みます。不足エントリの作成は選択したプロファイルでスクレイピングします。',
      optionsLabel: 'オプション',
      updateExistingLabel: '既存エントリを更新',
      createMissingLabel: '不足エントリを作成',
      profileLabel: 'ノベルプロファイル',
      profilePlaceholder: 'プロファイルを選択',
      runLabel: 'インポートを実行',
      runDescription: 'アプリタスクとして実行します。上のオプションはこの実行にのみ適用されます',
      startImport: 'インポート'
    },

    automation: {
      title: '推奨自動化',
      description:
        'ここでは推奨の NeoDB テンプレートのみ作成します。有効化・トリガー・履歴はアプリの自動化ページで管理します',
      create: '作成'
    },

    maintenance: {
      instanceTitle: 'インスタンス',
      instanceDescription:
        '任意の NeoDB デプロイで動作します。サインインはそのインスタンスに紐付きます。',
      instanceUrlLabel: 'インスタンス URL',
      instanceUrlDescription: 'NeoDB インスタンスのルート',
      restoreDefaults: 'フラッグシップインスタンスに戻す',
      clientTitle: 'クライアント',
      clientDescription: 'すべての NeoDB リクエストに適用されます',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回のレスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      actionsTitle: 'メンテナンス操作',
      actionsDescription: 'これらの操作は直ちに反映され、元に戻せません',
      reset: '既定の設定に戻す',
      resetDescription: 'インスタンスと設定が既定値に戻ります。サインインは保持されます。'
    }
  }
}
