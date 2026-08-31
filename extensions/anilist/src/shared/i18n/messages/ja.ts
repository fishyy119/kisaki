import type { AnilistMessages } from '../index'

export const ja: AnilistMessages = {
  errors: {
    authRequired: 'まず AniList アカウントにサインインしてください',
    tokenExpired: 'AniList のサインインが期限切れです。再度サインインしてください。',
    notFound: 'その AniList エントリは存在しません',
    rateLimited: 'AniList へのリクエストが多すぎます。しばらくしてから再試行してください。',
    rejected: 'AniList API がリクエストを拒否しました',
    unavailable: 'AniList API は一時的に利用できません',
    networkFailed: 'AniList API のネットワークリクエストに失敗しました',
    operationCancelled: '操作はキャンセルされました',
    baseUrlInvalid: 'http または https のアドレスを入力してください',
    idInvalid: ({ value }) => `「${value}」は有効な AniList ID ではありません`,
    relayUnavailable: 'Kisaki OAuth リレーは一時的に利用できません。後でもう一度お試しください。',
    loginSessionExpired:
      'AniList サインインセッションの有効期限が切れました。再度サインインしてください。',
    loginCallbackInvalid:
      'AniList サインインのコールバック検証に失敗しました。再度サインインしてください。',
    noPendingLogin: '完了待ちの AniList サインインはありません',
    loginNotReady: 'AniList サインインはまだ準備できていません',
    operationRunning: 'AniList リストの操作が既に実行中です。完了までお待ちください。'
  },

  oauth: {
    loginSucceededTitle: 'AniList サインインが完了しました',
    loginFailedTitle: 'AniList サインインに失敗しました',
    loginCompleted: ({ userName }) => `${userName} としてサインインしました`,
    callbackFailed: 'AniList サインインを完了できませんでした'
  },

  auth: {
    expiresSoonTitle: 'AniList サインインの期限が近づいています',
    expiresSoon: ({ days }) =>
      days > 0
        ? `AniList トークンは ${days} 日後に期限切れになります。再度サインインして更新してください。`
        : 'AniList トークンは期限切れです。再度サインインしてください。'
  },

  sync: {
    autoSyncFailedTitle: 'AniList 同期に失敗しました',
    autoSyncFailedFallback: '変更を AniList に送信できませんでした',
    pushTaskTitle: 'ライブラリを AniList リストへ送信',
    pushSummary: ({ pushed, skipped, failed }) =>
      `送信 ${pushed} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  import: {
    taskTitle: 'AniList リストをインポート',
    phaseRead: 'AniList リストを読み込み中',
    phaseApply: 'リストのエントリを適用中',
    itemFailed: ({ id }) => `${id} のインポートに失敗しました`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `作成 ${created} 件、更新 ${updated} 件、変更なし ${unchanged} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  commands: {
    verifyAccount: {
      title: 'AniList アカウントを確認',
      description: '保存済みサインインを AniList API に照会し、期限が近づくと警告します'
    },
    pushAll: {
      title: 'ライブラリを AniList へ送信',
      description: 'AniList ID を持つすべてのエントリをリストへ送信します'
    },
    importLists: {
      title: 'AniList リストをインポート',
      description: 'リストのステータスとスコアを一致するローカルエントリへ書き込みます'
    }
  },

  automations: {
    names: {
      'auth-check': 'AniList: 起動時にアカウントを確認',
      'push-full-daily': 'AniList: 毎日の全件送信',
      'import-refresh-weekly': 'AniList: 毎週のリスト更新'
    },
    labels: {
      'auth-check': '起動時にアカウントを確認',
      'push-full-daily': '毎日の全件送信',
      'import-refresh-weekly': '毎週のリスト更新'
    },
    descriptions: {
      'auth-check': 'アプリ起動時に AniList サインインを確認し、トークンの期限前に警告します',
      'push-full-daily': '毎日早朝に、関連付け済みの全エントリを AniList リストへ送信します',
      'import-refresh-weekly':
        '毎週、リストのステータスとスコアを既存エントリへ再インポートします'
    },
    status: {
      missing: '未作成',
      enabled: '有効',
      disabled: '無効'
    }
  },

  settings: {
    webviewTitle: 'AniList',
    commandLabel: '設定',
    commandDescription: 'AniList へのサインイン、リストのインポート、スクレイピング設定を行います'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'AniList の設定を読み込めませんでした',
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
      expiresSoon: 'まもなく期限切れ',
      expired: '期限切れ',
      autoSyncLabel: '自動送信',
      enabled: '有効',
      disabled: '無効',
      withScore: 'ステータスとスコア',
      withoutScore: 'ステータスのみ',
      recommendedAutomations: '推奨自動化',
      automationsComplete: 'すべて作成済み',
      automationsMissing: ({ count }) => `${count} 件未作成`,
      templatesCount: ({ count }) => `テンプレート ${count} 件`,
      runtimeTitle: '実行状況',
      runningJobs: '実行中の AniList タスク',
      running: '実行中',
      idle: '待機中',
      quickActionsTitle: 'ショートカット',
      importAction: 'AniList リストをインポート',
      maintenanceAction: 'エンドポイントとクライアント設定を調整',
      automationsTitle: '自動化テンプレート'
    },

    account: {
      title: 'アカウント',
      description:
        'ブラウザからサインインして AniList リストと連携します。トークンは約 1 年間有効で、更新はできません。',
      statusLabel: 'ステータス',
      configuredLabel: 'サインイン済み',
      missingLabel: '未サインイン',
      pendingLabel: 'ブラウザでのサインインを待機中…',
      expiresAtLabel: 'トークン有効期限',
      expiredLabel: '期限切れ',
      login: 'AniList でサインイン',
      completeLogin: '認可を完了しました',
      cancelLogin: 'サインインをキャンセル',
      logout: 'サインアウト',
      verify: 'アカウントを確認',
      verifiedAs: ({ userName }) => `${userName} としてサインイン中`
    },

    sync: {
      preferencesTitle: '自動送信の設定',
      syncEnabledLabel: '変更を自動送信',
      syncEnabledDescription:
        'AniList ID を持つエントリのステータスとスコアの変更をリストへ送信します',
      pushScoreLabel: 'スコアを含める',
      pushScoreDescription:
        'ローカルスコアを AniList に書き込みます。スコアが空でも消去はされません。',
      manualTitle: '手動送信',
      manualDescription:
        'AniList ID を持つすべてのエントリをリストへ送信します。進行状況とキャンセルはタスクセンターが扱います。',
      pushAll: '今すぐ全件送信'
    },

    import: {
      title: 'リストをインポート',
      description:
        'リストのステータスとスコアを一致するエントリへ書き込みます。不足エントリの作成は選択したプロファイルでスクレイピングします。',
      optionsLabel: 'オプション',
      listAnime: 'アニメリスト',
      listManga: 'マンガリスト',
      updateExistingLabel: '既存エントリを更新',
      createMissingLabel: '不足エントリを作成',
      animeProfileLabel: 'アニメプロファイル',
      comicProfileLabel: 'マンガプロファイル',
      novelProfileLabel: 'ノベルプロファイル',
      profilePlaceholder: 'プロファイルを選択',
      runLabel: 'インポートを実行',
      runDescription: 'アプリタスクとして実行します。上のオプションはこの実行にのみ適用されます',
      startImport: 'インポート'
    },

    automation: {
      title: '推奨自動化',
      description:
        'ここでは推奨の AniList テンプレートのみ作成します。有効化・トリガー・履歴はアプリの自動化ページで管理します',
      create: '作成'
    },

    maintenance: {
      endpointTitle: 'エンドポイント',
      endpointDescription: '公式ホストに接続できない場合はミラーを指定します',
      graphqlUrlLabel: 'GraphQL URL',
      graphqlUrlDescription: 'AniList GraphQL API のルート',
      restoreDefaults: '公式エンドポイントに戻す',
      clientTitle: 'スクレイピングとクライアント',
      clientDescription: 'すべての AniList 検索とスクレイピングに適用されます',
      preferRomajiLabel: 'ローマ字タイトルを優先',
      preferRomajiDescription:
        'コンテンツ言語に対応するタイトルがない場合、ローマ字タイトルを表示名として使用します',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回の AniList レスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      actionsTitle: 'メンテナンス操作',
      actionsDescription: 'これらの操作は直ちに反映され、元に戻せません',
      reset: '既定の設定に戻す',
      resetDescription: 'エンドポイントと設定が既定値に戻ります。サインインは保持されます。'
    }
  }
}
