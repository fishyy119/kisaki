import type { SteamMessages } from '../index'

export const ja: SteamMessages = {
  errors: {
    keyRequired: 'まず Steam Web API キーを保存してください',
    steamIdInvalid: '有効な SteamID64 を入力してください(7656 で始まる 17 桁の数字)',
    keyRejected: 'Steam が Web API キーを拒否しました',
    profileRequired: 'まずゲームのスクレイピングプロファイルを作成してください',
    profileNotVisible:
      'Steam からゲームが返されませんでした。SteamID と、プロフィールのゲーム詳細が公開されているか確認してください。',
    notFound: 'その Steam アプリは存在しないか、ストアで公開されていません',
    rateLimited: 'Steam へのリクエストが多すぎます。しばらくしてから再試行してください。',
    rejected: 'Steam API がリクエストを拒否しました',
    unavailable: 'Steam API は一時的に利用できません',
    networkFailed: 'Steam へのネットワークリクエストに失敗しました',
    operationCancelled: '操作はキャンセルされました',
    idInvalid: ({ value }) => `「${value}」は有効な Steam アプリ ID ではありません`,
    keyEmpty: 'Web API キーを入力してください',
    operationRunning: 'Steam インポートが既に実行中です。完了までお待ちください。'
  },

  import: {
    taskTitle: '所有している Steam ゲームをインポート',
    phaseRead: '所有ゲームを読み込み中',
    phaseApply: 'エントリを作成中',
    itemFailed: ({ id }) => `${id} のインポートに失敗しました`,
    summary: ({ created, existing, failed }) =>
      `作成 ${created} 件、既存 ${existing} 件、失敗 ${failed} 件`
  },

  commands: {
    verifyAccount: {
      title: 'Steam アカウントを確認',
      description: '所有ゲームを数えて、保存済みの Web API キーと SteamID を確認します'
    },
    importOwned: {
      title: '所有している Steam ゲームをインポート',
      description: 'ライブラリにまだない所有ゲームのエントリを作成します'
    }
  },

  automations: {
    names: {
      'auth-check': 'Steam: 起動時にアカウントを確認',
      'import-refresh-weekly': 'Steam: 毎週の所有ゲームインポート'
    },
    labels: {
      'auth-check': '起動時にアカウントを確認',
      'import-refresh-weekly': '毎週の所有ゲームインポート'
    },
    descriptions: {
      'auth-check': 'アプリ起動時に Steam Web API キーと SteamID を確認します',
      'import-refresh-weekly':
        '毎週、テンプレートに固定されたプロファイルで新しく所有したゲームをインポートします'
    },
    status: {
      missing: '未作成',
      enabled: '有効',
      disabled: '無効'
    }
  },

  settings: {
    webviewTitle: 'Steam',
    commandLabel: '設定',
    commandDescription:
      'Steam アカウントの接続、所有ゲームのインポート、スクレイピング設定を行います'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'Steam の設定を読み込めませんでした',
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
      keyConfigured: 'キー保存済み',
      noKey: 'キー未保存',
      available: '利用可能',
      recommendedAutomations: '推奨自動化',
      automationsComplete: 'すべて作成済み',
      automationsMissing: ({ count }) => `${count} 件未作成`,
      templatesCount: ({ count }) => `テンプレート ${count} 件`,
      runtimeTitle: '実行状況',
      runningJobs: '実行中の Steam タスク',
      running: '実行中',
      idle: '待機中',
      quickActionsTitle: 'ショートカット',
      importAction: '所有している Steam ゲームをインポート',
      maintenanceAction: 'クライアント設定を調整',
      automationsTitle: '自動化テンプレート'
    },

    account: {
      title: 'アカウント',
      description:
        '所有ゲームのインポートには個人の Web API キーとアカウントの SteamID64 が必要です。プロフィールのゲーム詳細は公開されている必要があります。',
      statusLabel: 'ステータス',
      configuredLabel: 'キー保存済み',
      missingLabel: 'キー未保存',
      keyLabel: 'Web API キー',
      keyPlaceholder: 'Web API キーを貼り付け',
      steamIdLabel: 'SteamID64',
      steamIdDescription: '17 桁の数字。プロフィール URL やサードパーティツールで確認できます',
      saveKey: 'キーを保存',
      clearKey: 'キーを削除',
      verify: '確認',
      verifiedGames: ({ count }) => `${count} 本のゲームが表示可能`,
      openKeyPage: 'Web API キーを取得'
    },

    import: {
      title: '所有ゲームのインポート',
      description:
        '所有ライブラリを読み込み、選択したプロファイルで不足エントリを作成します。既に Steam ID を持つエントリは変更されません。',
      profileLabel: 'ゲームプロファイル',
      profilePlaceholder: 'プロファイルを選択',
      runLabel: 'インポートを実行',
      runDescription: 'アプリタスクとして実行します。上のオプションはこの実行にのみ適用されます',
      startImport: '所有ゲームをインポート'
    },

    automation: {
      title: '推奨自動化',
      description:
        'ここでは推奨の Steam テンプレートのみ作成します。有効化・トリガー・履歴はアプリの自動化ページで管理します',
      create: '作成'
    },

    maintenance: {
      clientTitle: 'クライアント',
      clientDescription: 'すべての Steam リクエストに適用されます',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回のレスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      actionsTitle: 'メンテナンス操作',
      actionsDescription: 'これらの操作は直ちに反映され、元に戻せません',
      reset: '既定の設定に戻す',
      resetDescription: '設定が既定値に戻ります。保存済みのキーは保持されます。'
    }
  }
}
