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

  commands: {
    importLibrary: {
      title: 'Google Books ライブラリをインポート',
      description: 'ライブラリとシェルフのステータスを一致するローカルエントリへ書き込みます'
    }
  },

  automations: {
    names: {
      'import-refresh-weekly': 'Google Books: 毎週のライブラリ更新'
    },
    labels: {
      'import-refresh-weekly': '毎週のライブラリ更新'
    },
    descriptions: {
      'import-refresh-weekly':
        '毎週、ライブラリとシェルフのステータスを既存エントリへ再インポートします'
    },
    status: {
      missing: '未作成',
      enabled: '有効',
      disabled: '無効'
    }
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
      signedIn: 'サインイン済み',
      notSignedIn: '未サインイン',
      available: '利用可能',
      recommendedAutomations: '推奨自動化',
      automationsComplete: 'すべて作成済み',
      automationsMissing: ({ count }) => `${count} 件未作成`,
      templatesCount: ({ count }) => `テンプレート ${count} 件`,
      runtimeTitle: '実行状況',
      runningJobs: '実行中の Google Books タスク',
      running: '実行中',
      idle: '待機中',
      quickActionsTitle: 'ショートカット',
      importAction: 'Google Books ライブラリをインポート',
      maintenanceAction: 'クライアント設定を調整',
      automationsTitle: '自動化テンプレート'
    },

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

    import: {
      title: 'ライブラリのインポート',
      description:
        '購入済みライブラリと読書シェルフを読み込み、一致するエントリへステータスを書き込み、不足エントリは選択したプロファイルで作成します。Google Books が扱うのは購入であり追跡ではないため、書き戻しは行いません。',
      includeEbooksLabel: 'マイ Google eBooks',
      includeEbooksDescription:
        '購入・アップロード済みのライブラリ。ステータスなしでインポートされます',
      includeShelvesLabel: '読書シェルフ',
      includeShelvesDescription: '読みたい・読書中・読了がエントリのステータスになります',
      mergeSeriesLabel: 'シリーズの巻をまとめる',
      mergeSeriesDescription: '同一シリーズの複数巻は最初の巻のみでエントリを作成します',
      optionsLabel: 'オプション',
      updateExistingLabel: '既存エントリを更新',
      createMissingLabel: '不足エントリを作成',
      novelProfileLabel: 'ノベルプロファイル',
      comicProfileLabel: 'コミックプロファイル',
      profilePlaceholder: 'プロファイルを選択',
      runLabel: 'インポートを実行',
      runDescription: 'アプリタスクとして実行します。上のオプションはこの実行にのみ適用されます',
      startImport: 'インポート'
    },

    automation: {
      title: '推奨自動化',
      description:
        'ここでは推奨の Google Books テンプレートのみ作成します。有効化・トリガー・履歴はアプリの自動化ページで管理します',
      create: '作成'
    },

    maintenance: {
      clientTitle: 'クライアント',
      clientDescription: 'すべての Google Books リクエストに適用されます',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回のレスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      actionsTitle: 'メンテナンス操作',
      actionsDescription: 'これらの操作は直ちに反映され、元に戻せません',
      reset: '既定の設定に戻す',
      resetDescription: '設定が既定値に戻ります。サインインは保持されます。'
    }
  }
}
