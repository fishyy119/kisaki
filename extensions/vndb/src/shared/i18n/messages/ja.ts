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
    idInvalid: ({ value }) => `「${value}」は有効な VNDB ID ではありません`,
    listPermissionMissing:
      'この VNDB トークンではリストを読み取れません。listread と listwrite の権限を持つトークンを作成してください。',
    operationRunning: 'VNDB リストの操作が既に実行中です。完了までお待ちください。'
  },

  sync: {
    autoSyncFailedTitle: 'VNDB 同期に失敗しました',
    autoSyncFailedFallback: '変更を VNDB に送信できませんでした',
    pushTaskTitle: 'ライブラリを VNDB リストへ送信',
    pushSummary: ({ pushed, skipped, failed }) =>
      `送信 ${pushed} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  import: {
    taskTitle: 'VNDB リストをインポート',
    phaseRead: 'VNDB リストを読み込み中',
    phaseApply: 'リストのエントリを適用中',
    itemFailed: ({ id }) => `${id} のインポートに失敗しました`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `作成 ${created} 件、更新 ${updated} 件、変更なし ${unchanged} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  commands: {
    verifyAccount: {
      title: 'VNDB アカウントを確認',
      description: '保存済みトークンとそのリスト権限を VNDB API に照会します'
    },
    pushAll: {
      title: 'ライブラリを VNDB へ送信',
      description: 'VNDB ID を持つすべてのエントリをリストへ送信します'
    },
    importList: {
      title: 'VNDB リストをインポート',
      description: 'リストのステータスと投票を一致するローカルエントリへ書き込みます'
    }
  },

  automations: {
    names: {
      'auth-check': 'VNDB: 起動時にアカウントを確認',
      'push-full-daily': 'VNDB: 毎日の全件送信',
      'import-refresh-weekly': 'VNDB: 毎週のリスト更新'
    },
    labels: {
      'auth-check': '起動時にアカウントを確認',
      'push-full-daily': '毎日の全件送信',
      'import-refresh-weekly': '毎週のリスト更新'
    },
    descriptions: {
      'auth-check': 'アプリ起動時に VNDB トークンとそのリスト権限を確認します',
      'push-full-daily': '毎日早朝に、関連付け済みの全エントリを VNDB リストへ送信します',
      'import-refresh-weekly':
        '毎週、リストのステータスと投票を既存エントリへ再インポートします'
    },
    status: {
      missing: '未作成',
      enabled: '有効',
      disabled: '無効'
    }
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
      tokenConfigured: 'トークン設定済み',
      anonymous: '匿名アクセス',
      available: '利用可能',
      autoSyncLabel: '自動送信',
      enabled: '有効',
      disabled: '無効',
      withScore: 'ステータスと投票',
      withoutScore: 'ステータスのみ',
      recommendedAutomations: '推奨自動化',
      automationsComplete: 'すべて作成済み',
      automationsMissing: ({ count }) => `${count} 件未作成`,
      templatesCount: ({ count }) => `テンプレート ${count} 件`,
      runtimeTitle: '実行状況',
      runningJobs: '実行中の VNDB タスク',
      running: '実行中',
      idle: '待機中',
      quickActionsTitle: 'ショートカット',
      importAction: 'VNDB リストをインポート',
      maintenanceAction: 'エンドポイントとクライアント設定を調整',
      automationsTitle: '自動化テンプレート'
    },

    account: {
      title: 'API トークン',
      description:
        'Kana API は公開されているため、トークンなしでもスクレイピングできます。個人トークンを追加するとレート上限が上がります。リスト連携には listread と listwrite が必要です。',
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
      openSettings: 'vndb.org でトークンを作成',
      verify: 'アカウントを確認',
      verifiedAs: ({ username }) => `${username} としてサインイン中`,
      permissionsLabel: 'リスト権限',
      listRead: '読み取り',
      listWrite: '書き込み',
      permissionGranted: '許可済み',
      permissionMissing: '不足'
    },

    sync: {
      preferencesTitle: '自動送信の設定',
      preferencesDescription:
        'リストへの送信には listread と listwrite の権限を持つトークンが必要です',
      syncEnabledLabel: '変更を自動送信',
      syncEnabledDescription:
        'VNDB ID を持つエントリのステータスとスコアの変更をリストへ送信します',
      pushScoreLabel: 'スコアを含める',
      pushScoreDescription:
        'ローカルスコアを VNDB の投票として書き込みます。スコアが空でも投票は消去されません。',
      manualTitle: '手動送信',
      manualDescription:
        'VNDB ID を持つすべてのエントリをリストへ送信します。進行状況とキャンセルはタスクセンターが扱います。',
      pushAll: '今すぐ全件送信'
    },

    import: {
      title: 'リストをインポート',
      description:
        'リストのステータスと投票を一致するエントリへ書き込みます。不足エントリの作成は選択したプロファイルでスクレイピングします。',
      optionsLabel: 'オプション',
      updateExistingLabel: '既存エントリを更新',
      createMissingLabel: '不足エントリを作成',
      profileLabel: 'ゲームプロファイル',
      profilePlaceholder: 'プロファイルを選択',
      runLabel: 'インポートを実行',
      runDescription: 'アプリタスクとして実行します。上のオプションはこの実行にのみ適用されます',
      startImport: 'インポート'
    },

    automation: {
      title: '推奨自動化',
      description:
        'ここでは推奨の VNDB テンプレートのみ作成します。有効化・トリガー・履歴はアプリの自動化ページで管理します',
      create: '作成'
    },

    maintenance: {
      endpointTitle: 'エンドポイント',
      endpointDescription: '公式ホストに接続できない場合はミラーを指定します',
      apiBaseUrlLabel: 'API ベース URL',
      apiBaseUrlDescription: 'VNDB Kana API のルート',
      restoreDefaults: '公式エンドポイントに戻す',
      clientTitle: 'スクレイピングとクライアント',
      clientDescription: 'すべての VNDB 検索とスクレイピングに適用されます',
      preferRomanizedLabel: 'ローマ字タイトルを優先',
      preferRomanizedDescription:
        'コンテンツ言語に対応するタイトルがない場合、ローマ字タイトルを表示名として使用します',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回の VNDB レスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      actionsTitle: 'メンテナンス操作',
      actionsDescription: 'これらの操作は直ちに反映され、元に戻せません',
      reset: '既定の設定に戻す',
      resetDescription: 'エンドポイントと設定が既定値に戻ります。トークンは保持されます。',
      resetSucceeded: '既定の設定に戻しました'
    }
  }
}
