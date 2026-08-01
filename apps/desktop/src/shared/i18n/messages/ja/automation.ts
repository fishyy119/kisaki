import type { Messages } from '../schema'

/** Automation: page, toolbar, rows, form dialog, details dialog, and run history. */
export const automation = {
  title: '自動化',
  addAutomation: '自動化を追加',

  display: {
    onStartup: '起動時',
    manualOnly: '手動実行のみ',
    triggerSeparator: '、',
    systemTimezone: 'システムのタイムゾーン',
    noRetry: '再試行しない',
    retryTimes: ({ count }: { count: number }) => `${count} 回再試行`,
    pauseAfterFailure: '失敗後に一時停止',
    pauseAfterFailureWithRetry: ({ count }: { count: number }) =>
      `失敗後に一時停止（先に ${count} 回再試行）`,
    never: '未実行',
    statusCompleted: '完了',
    statusFailed: '失敗',
    triggerManual: '手動',
    triggerStartup: '起動'
  },

  feedback: {
    notTriggered: '自動化はトリガーされませんでした。',
    runCompleted: '自動化の実行が完了しました。',
    runFailed: '自動化の実行に失敗しました',
    runError: '自動化を実行できませんでした',
    stopRequested: '自動化の再試行停止をリクエストしました。',
    notRunning: '自動化は実行中ではありません。',
    stopFailed: '自動化を停止できませんでした',
    enabled: '自動化を有効にしました。',
    disabled: '自動化を無効にしました。',
    updateFailed: '自動化を更新できませんでした',
    deleted: '自動化を削除しました。',
    deleteFailed: '自動化を削除できませんでした',
    updated: '自動化を更新しました。',
    added: '自動化を追加しました。',
    saveFailed: '自動化を保存できませんでした',
    selectCommand: 'コマンドを選択してください。'
  },

  page: {
    emptyDescription: '自動化はまだありません。',
    noMatchDescription: '一致する自動化がありません。',
    table: {
      name: '名前',
      command: 'コマンド',
      trigger: 'トリガー',
      run: '実行',
      status: 'ステータス',
      actions: '操作'
    },
    deleteTitle: '自動化を削除しますか？',
    deleteDescription: ({ name }: { name: string }) =>
      `「${name}」を削除しますか？この操作は取り消せません。`,
    deleting: '削除中'
  },

  row: {
    app: 'アプリ',
    nextRun: ({ label }: { label: string }) => `次回 ${label}`,
    nextNone: 'なし',
    disabled: '無効',
    running: '実行中',
    notInvoked: '未実行',
    stopRetry: '再試行を停止',
    run: '実行',
    details: '詳細'
  },

  toolbar: {
    filterAll: 'すべて',
    filterEnabled: '有効',
    filterDisabled: '無効',
    filterRunning: '実行中',
    filterFailed: '失敗',
    sortCreatedAt: '作成日時',
    sortName: '名前',
    sortLastRunAt: '前回の実行',
    sortNextRunAt: '次回の実行',
    sourceAll: 'すべてのソース',
    sourceApp: 'アプリ',
    sourceExtension: '拡張機能',
    searchPlaceholder: '自動化を検索…',
    ascending: '昇順',
    descending: '降順'
  },

  form: {
    addTitle: '自動化を追加',
    editTitle: '自動化を編集',
    commandUnavailable: 'コマンドは現在利用できません。',
    name: '名前',
    namePlaceholder: '自動化の名前',
    command: 'コマンド',
    trigger: 'トリガー',
    configure: '設定',
    failurePolicy: '失敗時の動作',
    policyNone: '再試行しない',
    policyRetry: '再試行',
    policyPause: '失敗後に一時停止',
    retryCount: '再試行回数',
    retryDelay: '再試行の間隔',
    seconds: '秒',
    params: 'パラメーター',
    configureTrigger: 'トリガーを設定',
    runOnStartup: '起動時に実行',
    expression: '式',
    cronPlaceholder: 'Cron 式。空欄の場合は無効',
    timezone: 'タイムゾーン',
    timezonePlaceholder: 'システムのタイムゾーン',
    paramsMustBeObject: 'パラメーターは JSON オブジェクトである必要があります。',
    cronRequired: 'Cron 式を入力してください。',
    retryCountLabel: '再試行回数',
    retryDelaySecondsLabel: '再試行の間隔（秒）',
    mustBePositive: ({ label }: { label: string }) => `${label}は 0 より大きい値にしてください。`,
    mustBeNonNegativeInteger: ({ label }: { label: string }) =>
      `${label}は 0 以上の整数にしてください。`,
    invalidTimezone: 'タイムゾーンが無効です。'
  },

  details: {
    app: 'アプリ',
    running: '実行中',
    command: 'コマンド',
    source: 'ソース',
    trigger: 'トリガー',
    runTime: '実行時間',
    lastRun: ({ time }: { time: string }) => `前回 ${time}`,
    nextRun: ({ time }: { time: string }) => `次回 ${time}`,
    nextNone: 'なし',
    nextDisabled: '無効',
    createdAt: '作成',
    updatedAt: '更新',
    params: 'パラメーター',
    history: '実行履歴',
    historyCount: ({ count }: { count: number }) => `${count} 件`,
    noHistory: '実行履歴はまだありません。',
    historyRun: '実行',
    historyTrigger: 'トリガー',
    historyStartedAt: '開始日時',
    historyDuration: '所要時間',
    historyResult: '結果',
    viewFullResult: '完全な結果を表示',
    runResult: '実行結果',
    runResultTitle: ({ title }: { title: string }) => `実行結果 ${title}`,
    attempt: '試行',
    startedAt: '開始',
    finishedAt: '終了',
    duration: '所要時間',
    error: 'エラー',
    result: '結果',
    noError: 'エラーはありません。'
  },

  combobox: {
    searchPlaceholder: 'コマンドを検索…',
    selectPlaceholder: 'コマンドを選択…',
    unavailable: 'コマンドは現在利用できません。'
  }
} satisfies Messages['automation']
