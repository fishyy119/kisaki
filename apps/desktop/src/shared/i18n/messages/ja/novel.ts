import type { Messages } from '@shared/i18n'

export const novel = {
  readStart: '読み始める',
  readContinue: '続きを読む',
  stop: '停止',
  volumes: {
    title: '巻',
    emptyTitle: 'まだ巻がありません',
    emptyHint: '小説フォルダーをスキャンするかメタデータを取得して巻一覧を作成します',
    unnamed: ({ number }: { number: string }) => `第${number}巻`,
    entityLabel: '巻',
    read: '既読',
    unread: '未読',
    resumeProgress: ({ percent }: { percent: number }) => `${percent}% から再開`,
    markRead: '既読にする',
    markUnread: '未読にする',
    readUpdated: '閲覧状態を更新しました',
    progress: ({ read, total }: { read: number; total: number }) => `既読 ${read} / ${total}`,
    readCount: '読了回数',
    readAt: '読了日時',
    releaseDate: '発売日',

    catchUp: {
      title: '残りの巻を既読にしますか？',
      pendingCount: ({ count }: { count: number }) => `${count} 巻が未読のままです`,
      hint: '閲覧状態のみを記録し、読書時間は記録しません',
      markAll: 'すべて既読',
      skip: 'スキップ',
      marked: ({ count }: { count: number }) => `${count} 巻を既読にしました`
    },

    addVolume: '巻を追加',
    editVolume: '巻を編集',
    deleteVolume: '巻を削除',
    volumeDeleted: '巻を削除しました',
    numberLabel: '巻数',
    numberPlaceholder: '任意',
    numberInvalid: '巻数は正の数で入力してください',
    numberRequired: '巻には巻数か名前が必要です',

    syncFiles: 'ファイルを同期',
    syncCompleted: ({ volumes, files }: { volumes: number; files: number }) =>
      `${volumes} 巻と ${files} 件のファイルを同期しました`,
    syncFailed: 'ファイル同期に失敗しました',
    syncUnrecognized: ({ count }: { count: number }) =>
      `${count} 件のファイルは巻数を判別できません`
  },

  files: {
    title: 'ファイル',
    readFile: 'このファイルを読む',
    missingFile: 'ファイルなし',
    noFiles: 'まだファイルがありません',
    fileCount: ({ count }: { count: number }) => `${count} 件のファイル`,
    primary: 'プライマリ',
    openFolder: '保存先フォルダーを開く',
    openFolderFailed: '保存先フォルダーを開けませんでした',
    setPrimary: 'プライマリに設定',
    primaryUpdated: 'プライマリファイルを更新しました',
    removeFile: 'ファイル記録を削除',
    fileRemoved: 'ファイル記録を削除しました',
    recordEntityLabel: 'ファイル記録',
    addFile: 'ファイルを追加',
    fileAttached: 'ファイルを追加しました',
    attachFailed: 'ファイルを追加できませんでした',
    manualBadge: '手動',
    noteLabel: 'メモ',
    editNote: 'メモを編集',
    noteSaved: 'メモを保存しました'
  },

  detail: {
    openNovelDir: '小説フォルダーを開く',
    novelDirNotSet: '小説フォルダーが設定されていません',
    readStatus: '閲覧状況'
  },

  filesConfig: {
    title: 'ファイル設定',
    novelDirLabel: '小説フォルダー',
    novelDirPlaceholder: '未設定',
    selectDir: 'フォルダーを選択',
    novelDirHint:
      'ファイル同期はこのフォルダーをスキャンして巻ファイルを照合します。空のままにすると完全に手動管理になります。変更を保存するとファイルを再同期します。'
  },

  statusDialog: {
    title: '閲覧状況を編集',
    label: '閲覧状況',
    selectStatus: '状態を選択'
  },

  lastActiveDialog: {
    title: '最終閲覧日時を編集',
    label: '最終閲覧日時',
    emptyHint: '空のままにすると未閲覧になります'
  },

  duration: {
    title: '読書時間を編集',
    totalTime: '合計読書時間',
    sessionsDuration: ({ value }: { value: string }) => `セッション：${value}`,
    untrackedDuration: ({ value }: { value: string }) => `未記録：${value}`,
    untrackedLabel: '未記録の読書時間',
    hoursUnit: '時間',
    minutesUnit: '分',
    untrackedHint: 'セッションに含まれない読書時間（インポートした履歴など）',
    sessionsHeader: ({ count }: { count: number }) => `セッション（${count}）`,
    emptySessions: 'まだセッション記録がありません。下から追加してください。',
    addRecord: '記録を追加',
    editRecord: '記録を編集',
    startTime: '開始時刻',
    endTime: '終了時刻',
    startEndRequired: '開始と終了の時刻を入力してください',
    endAfterStart: '終了時刻は開始時刻より後にしてください',
    overlap: '時間範囲が既存の記録と重複しています',
    recordAdded: '記録を追加しました',
    recordUpdated: '記録を更新しました',
    recordDeleted: '記録を削除しました',
    deleteRecordDescription: 'このセッション記録を削除しますか？この操作は元に戻せません。'
  },

  activity: {
    emptyTitle: 'まだ読書アクティビティがありません',
    emptyHint: '巻を読み始めると読書時間が自動的に記録されます',
    statsOverview: '統計概要',
    heatmap: 'アクティビティヒートマップ',
    trend: '読書トレンド',
    distribution: '時間帯分布',
    recentSessions: '最近のセッション',
    totalDuration: '読書時間',
    sessionCount: 'セッション数',
    sessionCountValue: ({ count }: { count: number }) => `${count} 回のセッション`,
    avgDuration: '平均セッション',
    longestSession: '最長セッション',
    currentStreak: '現在の連続日数',
    longestStreak: '最長連続日数',
    streakValue: ({ days }: { days: number }) => `${days} 日`,
    firstSession: '初回閲覧',
    lastSession: '最終閲覧',
    dayOfMonthLabel: ({ day }: { day: number }) => `${day} 日`
  }
} satisfies Messages['novel']
