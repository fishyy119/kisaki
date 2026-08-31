import type { MangadexMessages } from '../index'

export const ja: MangadexMessages = {
  errors: {
    authRequired: 'まず MangaDex パーソナルクライアントの資格情報を保存してください',
    authFailed: 'MangaDex が資格情報を拒否しました。4 つの値をすべて確認してください。',
    notFound: 'その MangaDex エントリは存在しません',
    rateLimited: 'MangaDex へのリクエストが多すぎます。しばらくしてから再試行してください。',
    rejected: 'MangaDex API がリクエストを拒否しました',
    unavailable: 'MangaDex API は一時的に利用できません',
    networkFailed: 'MangaDex へのネットワークリクエストに失敗しました',
    operationCancelled: '操作はキャンセルされました',
    idInvalid: ({ value }) => `「${value}」は有効な MangaDex ID ではありません`,
    credentialsIncomplete: '4 つの資格情報をすべて入力してください',
    operationRunning: 'MangaDex リストの操作が既に実行中です。完了までお待ちください。'
  },

  sync: {
    autoSyncFailedTitle: 'MangaDex 同期に失敗しました',
    autoSyncFailedFallback: '変更を MangaDex に送信できませんでした',
    pushTaskTitle: 'ライブラリを MangaDex へ送信',
    pushSummary: ({ pushed, skipped, failed }) =>
      `送信 ${pushed} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  import: {
    taskTitle: 'MangaDex の読書ステータスをインポート',
    phaseRead: 'MangaDex のステータスを読み込み中',
    phaseApply: 'エントリを適用中',
    itemFailed: ({ id }) => `${id} のインポートに失敗しました`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `作成 ${created} 件、更新 ${updated} 件、変更なし ${unchanged} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  commands: {
    verifyAccount: {
      title: 'MangaDex アカウントを確認',
      description: '保存済みの資格情報を MangaDex API に照会します'
    },
    pushAll: {
      title: 'ライブラリを MangaDex へ送信',
      description: 'MangaDex ID を持つすべてのエントリをアカウントへ送信します'
    },
    importStatuses: {
      title: 'MangaDex の読書ステータスをインポート',
      description: '読書ステータスと評価を一致するローカルエントリへ書き込みます'
    }
  },

  automations: {
    names: {
      'auth-check': 'MangaDex: 起動時にアカウントを確認',
      'push-full-daily': 'MangaDex: 毎日の全件送信',
      'import-refresh-weekly': 'MangaDex: 毎週のステータス更新'
    },
    labels: {
      'auth-check': '起動時にアカウントを確認',
      'push-full-daily': '毎日の全件送信',
      'import-refresh-weekly': '毎週のステータス更新'
    },
    descriptions: {
      'auth-check': 'アプリ起動時に MangaDex の資格情報を確認します',
      'push-full-daily': '毎日早朝に、関連付け済みの全エントリを MangaDex アカウントへ送信します',
      'import-refresh-weekly':
        '毎週、読書ステータスと評価を既存エントリへ再インポートします'
    },
    status: {
      missing: '未作成',
      enabled: '有効',
      disabled: '無効'
    }
  },

  settings: {
    webviewTitle: 'MangaDex',
    commandLabel: '設定',
    commandDescription:
      'MangaDex アカウントの接続、読書ステータスのインポート、スクレイピング設定を行います'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'MangaDex の設定を読み込めませんでした',
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
      connected: '接続済み',
      notConnected: '未接続',
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
      runningJobs: '実行中の MangaDex タスク',
      running: '実行中',
      idle: '待機中',
      quickActionsTitle: 'ショートカット',
      importAction: 'MangaDex の読書ステータスをインポート',
      maintenanceAction: 'エンドポイントとクライアント設定を調整',
      automationsTitle: '自動化テンプレート'
    },

    account: {
      title: 'アカウント',
      description:
        'MangaDex のパーソナルツールはパーソナル API クライアントでサインインします。MangaDex の設定で作成し、その ID とシークレット、アカウントのユーザー名とパスワードを入力してください。すべてローカルのシークレットストアにのみ保存されます。',
      statusLabel: 'ステータス',
      configuredLabel: '接続済み',
      missingLabel: '未接続',
      clientIdLabel: 'クライアント ID',
      clientSecretLabel: 'クライアントシークレット',
      usernameLabel: 'ユーザー名',
      passwordLabel: 'パスワード',
      save: 'アカウントを接続',
      clear: '接続を解除',
      verify: 'アカウントを確認',
      verifiedAs: ({ userName }) => `${userName} として接続中`,
      openClientSettings: 'MangaDex API クライアントページを開く'
    },

    sync: {
      preferencesTitle: '自動送信の設定',
      syncEnabledLabel: '変更を自動送信',
      syncEnabledDescription:
        'MangaDex ID を持つエントリのステータスとスコアの変更をアカウントへ送信します',
      pushScoreLabel: 'スコアを含める',
      pushScoreDescription:
        'ローカルスコアを MangaDex の評価として書き込みます。スコアが空でも消去はされません。',
      manualTitle: '手動送信',
      manualDescription:
        'MangaDex ID を持つすべてのエントリをアカウントへ送信します。進行状況とキャンセルはタスクセンターが扱います。',
      pushAll: '今すぐ全件送信'
    },

    import: {
      title: '読書ステータスをインポート',
      description:
        'ステータスを一致するエントリへ書き込みます。不足エントリの作成は選択したプロファイルでスクレイピングします。',
      optionsLabel: 'オプション',
      importScoresLabel: '評価もインポート',
      updateExistingLabel: '既存エントリを更新',
      createMissingLabel: '不足エントリを作成',
      profileLabel: 'マンガプロファイル',
      profilePlaceholder: 'プロファイルを選択',
      runLabel: 'インポートを実行',
      runDescription: 'アプリタスクとして実行します。上のオプションはこの実行にのみ適用されます',
      startImport: 'インポート'
    },

    automation: {
      title: '推奨自動化',
      description:
        'ここでは推奨の MangaDex テンプレートのみ作成します。有効化・トリガー・履歴はアプリの自動化ページで管理します',
      create: '作成'
    },

    maintenance: {
      endpointTitle: 'エンドポイント',
      endpointDescription: '公式ホストに接続できない場合はミラーを指定します',
      apiUrlLabel: 'API URL',
      apiUrlDescription: 'MangaDex REST API のルート。サインイン通信は公式ホストを使い続けます。',
      restoreDefaults: '公式エンドポイントに戻す',
      clientTitle: 'スクレイピングとクライアント',
      clientDescription: 'すべての MangaDex 検索とスクレイピングに適用されます',
      preferRomanizedLabel: 'ローマ字タイトルを優先',
      preferRomanizedDescription:
        'コンテンツ言語に対応するタイトルがない場合、ローマ字タイトルを表示名として使用します',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回のレスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      actionsTitle: 'メンテナンス操作',
      actionsDescription: 'これらの操作は直ちに反映され、元に戻せません',
      reset: '既定の設定に戻す',
      resetDescription: '設定が既定値に戻ります。保存済みの資格情報は保持されます。'
    }
  }
}
