import type { Messages } from '../schema'

/** Task center: run list, controls, details, and task-run display vocabulary. */
export const task = {
  center: 'タスクセンター',
  tabActive: '進行中',
  tabCompleted: '完了',
  noActiveTasks: '進行中のタスクはありません',
  noCompletedRecords: '完了した記録はありません',

  table: {
    task: 'タスク',
    progress: '進行状況',
    result: '結果',
    status: 'ステータス',
    actions: '操作'
  },

  toolbar: {
    searchActivePlaceholder: '進行中のタスクを検索…',
    searchCompletedPlaceholder: '完了した記録を検索…',
    refreshing: '更新中…',
    allCategories: 'すべてのカテゴリ',
    allStatuses: 'すべてのステータス',
    refresh: '更新',
    refreshList: 'タスク一覧を更新',
    clearCompleted: '完了した記録を消去'
  },

  feedback: {
    refreshFailed: 'タスクセンターを更新できませんでした',
    clearFailed: 'タスク記録を消去できませんでした',
    deleteFailed: 'タスク記録を削除できませんでした',
    pauseFailed: 'タスクを一時停止できませんでした',
    resumeFailed: 'タスクを再開できませんでした',
    cancelFailed: 'タスクをキャンセルできませんでした',
    cannotPauseNow: '現在このタスクは一時停止できません',
    cannotResumeNow: '現在このタスクは再開できません',
    cannotCancel: 'タスクは終了済みか、キャンセルできません'
  },

  row: {
    pause: '一時停止',
    pauseTask: 'タスクを一時停止',
    resume: '再開',
    resumeTask: 'タスクを再開',
    cancel: 'キャンセル',
    cancelTask: 'タスクをキャンセル',
    details: '詳細',
    viewDetails: '詳細を表示',
    deleteRecord: '記録を削除',
    duration: '所要時間',
    counters: 'カウント',
    warningCount: ({ count }: { count: number }) => `${count} 件の警告`,
    moreWarnings: ({ count }: { count: number }) => `ほか ${count} 件の警告`
  },

  progress: {
    progress: '進行状況',
    rate: '速度',
    eta: '残り',
    inProgress: '進行中',
    etaAbout: ({ duration }: { duration: string }) => `約 ${duration}`
  },

  details: {
    runId: 'タスク ID',
    category: 'カテゴリ',
    operation: '操作',
    operationId: '操作 ID',
    owner: 'ソース',
    initiator: '開始者',
    subject: '対象',
    createdAt: '作成',
    startedAt: '開始',
    finishedAt: '終了',
    duration: '所要時間',
    warnings: '警告',
    info: '情報',
    description: '説明',
    result: '結果',
    output: '出力',
    noResultSummary: '結果の概要はありません'
  },

  categories: {
    scanner: 'スキャン',
    ingest: 'インポート',
    extension: '拡張機能',
    updater: '更新',
    system: 'システム'
  },

  statuses: {
    queued: '待機中',
    running: '実行中',
    pausing: '一時停止中…',
    paused: '一時停止',
    cancelling: 'キャンセル中',
    completed: '完了',
    failed: '失敗',
    cancelled: 'キャンセル済み'
  },

  counters: {
    total: '合計',
    processed: '処理済み',
    succeeded: '成功',
    failed: '失敗',
    skipped: 'スキップ',
    warnings: '警告',
    added: '追加',
    existing: '既存',
    updated: '更新',
    deleted: '削除',
    changed: '変更',
    notModified: '変更なし'
  },

  subjects: {
    command: 'コマンド',
    automation: '自動化',
    scanner: 'スキャナー',
    game: 'ゲーム',
    anime: 'アニメ',
    comic: 'マンガ',
    novel: '小説',
    person: '人物',
    company: '会社',
    character: 'キャラクター',
    extension: '拡張機能',
    repository: 'リポジトリ',
    app: 'アプリ'
  },
  subjectValue: ({ label, value }: { label: string; value: string }) => `${label}：${value}`,

  operations: {
    scan: 'メディアをスキャン',
    installExtension: '拡張機能をインストール',
    updateExtension: '拡張機能を更新',
    importExtensionPackage: '拡張機能パッケージをインポート',
    uninstallExtension: '拡張機能をアンインストール',
    refreshRepository: '拡張機能リポジトリを更新',
    refreshAllRepositories: 'すべての拡張機能リポジトリを更新',
    checkUpdates: 'アプリの更新を確認',
    downloadUpdate: 'アプリの更新をダウンロード',
    systemMaintenance: 'システムメンテナンス',
    extensionTask: '拡張機能タスク',
    ingestAdd: ({ label }: { label: string }) => `${label}を追加`,
    ingestUpdate: ({ label }: { label: string }) => `${label}を更新`,
    ingestBatchAdd: ({ label }: { label: string }) => `${label}を一括追加`,
    ingestBatchUpdate: ({ label }: { label: string }) => `${label}を一括更新`,
    ingestBatchDelete: ({ label }: { label: string }) => `${label}を一括削除`,
    ingestFallbackEntity: 'アイテム'
  },

  owner: {
    app: 'アプリ',
    extension: ({ name }: { name: string }) => `拡張機能：${name}`
  },

  initiator: {
    user: 'ユーザー',
    automation: ({ name }: { name: string }) => `自動化：${name}`,
    extension: ({ name }: { name: string }) => `拡張機能：${name}`,
    system: 'システム',
    systemWithReason: ({ reason }: { reason: string }) => `システム：${reason}`
  },

  systemReasons: {
    startup: '起動',
    maintenance: 'メンテナンス',
    update: '更新',
    shutdown: '終了',
    watch: 'ファイル変更'
  },

  progressUnits: {
    item: '件',
    file: 'ファイル',
    byte: 'バイト',
    entity: '件',
    step: 'ステップ',
    package: 'パッケージ',
    request: 'リクエスト'
  },

  ratePeriods: {
    second: '秒',
    minute: '分',
    hour: '時間'
  },

  notifications: {
    cancelling: 'キャンセルしています…',
    pausing: '一時停止しています…',
    paused: '一時停止中',
    cancelUnavailable: 'タスクは終了済みか、キャンセルできません',
    finalCompleted: ({ title }: { title: string }) => `${title}が完了しました`,
    finalCancelled: ({ title }: { title: string }) => `${title}をキャンセルしました`,
    finalFailed: ({ title }: { title: string }) => `${title}が失敗しました`
  }
} satisfies Messages['task']
