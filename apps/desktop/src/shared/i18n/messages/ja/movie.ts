import type { Messages } from '../schema'

export const movie = {
  watchStart: '視聴',
  watchContinue: '続きから見る',
  watchAgain: 'もう一度見る',
  stop: '停止',
  showDetail: '詳細を表示',

  watch: {
    watched: '視聴済み',
    unwatched: '未視聴',
    markWatched: '視聴済みにする',
    markUnwatched: '未視聴にする',
    watchedUpdated: '視聴状態を更新しました。',
    resumeAt: ({ position }: { position: string }) => `${position} から再開`,
    clearResume: '再開位置をクリア',
    resumeCleared: '再開位置をクリアしました。',
    playCount: '再生回数',
    watchedAt: '視聴日時',
    resumeLabel: '再開位置',
    runtime: '上映時間'
  },

  extras: {
    title: '特典',
    emptyTitle: '特典がありません',
    emptyHint: 'フォルダー内の予告編や未公開シーンがここに表示されます。',
    entityLabel: '特典',
    addExtra: '特典を追加',
    extraAttached: '特典を追加しました',
    editTitle: '特典を編集',
    extraUpdated: '特典を更新しました',
    deleteExtra: '特典を削除',
    extraRemoved: '特典レコードを削除しました',
    play: '再生',
    playFailed: '特典の再生に失敗しました',
    stopFailed: '特典の停止に失敗しました',
    nameLabel: '名前',
    typeLabel: '種類',
    autoDetect: '自動判別'
  },

  files: {
    title: 'バージョン',
    emptyTitle: 'ファイルがありません',
    emptyHint: '映画フォルダーをスキャンするかファイルを追加すると再生できます。',
    playFile: 'このファイルを再生',
    missingFile: 'ファイルなし',
    noFiles: 'ファイルはまだありません。',
    fileCount: ({ count }: { count: number }) => `${count} ファイル`,
    primary: '優先',
    editionLabel: 'エディション',
    editionPlaceholder: '劇場版、ディレクターズカット…',
    editionSaved: 'エディションを保存しました。',
    resolution: '解像度',
    codec: 'コーデック',
    audioTracks: '音声トラック',
    subtitleTracks: '字幕トラック',
    audioTrackCount: ({ count }: { count: number }) => `音声 ${count}`,
    subtitleTrackCount: ({ count }: { count: number }) => `字幕 ${count}`,
    openFolder: '格納フォルダーを開く',
    openFolderFailed: '格納フォルダーを開けませんでした。',
    setPrimary: '優先に設定',
    primaryUpdated: '優先ファイルを更新しました。',
    removeFile: 'ファイル記録を削除',
    fileRemoved: 'ファイル記録を削除しました。',
    recordEntityLabel: 'ファイル記録',
    addFile: 'ファイルを追加',
    fileAttached: 'ファイルを追加しました。',
    attachFailed: 'ファイルを追加できませんでした。',
    manualBadge: '手動',
    noteLabel: 'メモ',
    editNote: 'メモを編集',
    noteSaved: 'メモを保存しました。',

    syncFiles: 'ファイルを同期',
    syncCompleted: ({ files, extras }: { files: number; extras: number }) =>
      `${files} ファイル、${extras} 特典を同期しました。`,
    syncFailed: 'ファイルの同期に失敗しました。'
  },

  player: {
    pause: '一時停止',
    resume: '再開',
    pauseFailed: '再生を一時停止できませんでした。',
    resumeFailed: '再生を再開できませんでした。'
  },

  detail: {
    openMovieDir: '映画フォルダーを開く',
    movieDirNotSet: '映画フォルダーが設定されていません。',
    watchStatus: '視聴ステータス'
  },

  filesConfig: {
    title: 'ファイル設定',
    movieDirLabel: '映画フォルダー',
    movieDirPlaceholder: '未設定',
    selectDir: 'フォルダーを選択',
    movieDirHint:
      '同期はこのフォルダーをスキャンして本編バージョンと特典を照合します。空欄の場合は完全に手動で管理します。変更を保存すると再同期します。'
  },

  statusDialog: {
    title: '視聴ステータスを編集',
    label: '視聴ステータス',
    selectStatus: 'ステータスを選択'
  },

  lastActiveDialog: {
    title: '最終視聴日時を編集',
    label: '最終視聴日時',
    emptyHint: '空欄の場合は未視聴扱いになります。'
  },

  duration: {
    title: '視聴時間を編集',
    totalTime: '合計視聴時間',
    sessionsDuration: ({ value }: { value: string }) => `セッション記録：${value}`,
    untrackedDuration: ({ value }: { value: string }) => `未記録時間：${value}`,
    untrackedLabel: '未記録の視聴時間',
    hoursUnit: '時間',
    minutesUnit: '分',
    untrackedHint: 'セッションに記録されていない視聴時間（インポートした履歴など）。',
    sessionsHeader: ({ count }: { count: number }) => `セッション記録（${count}）`,
    emptySessions: 'セッション記録がありません。下のボタンから追加できます',
    addRecord: '記録を追加',
    editRecord: '記録を編集',
    startTime: '開始時刻',
    endTime: '終了時刻',
    startEndRequired: '開始と終了の時刻を入力してください',
    endAfterStart: '終了時刻は開始時刻より後にしてください',
    overlap: '時間帯が既存の記録と重複しています',
    recordAdded: '記録を追加しました',
    recordUpdated: '記録を更新しました',
    recordDeleted: '記録を削除しました',
    deleteRecordDescription: 'このセッション記録を削除しますか？この操作は元に戻せません。'
  },

  activity: {
    emptyTitle: '視聴記録がありません',
    emptyHint: '再生を開始すると、視聴時間が自動で記録されます。',
    statsOverview: '統計概要',
    heatmap: 'アクティビティヒートマップ',
    trend: '視聴推移',
    distribution: '時間帯分布',
    recentSessions: '最近の視聴',
    totalDuration: '視聴時間',
    sessionCount: '視聴回数',
    sessionCountValue: ({ count }: { count: number }) => `${count} 回`,
    avgDuration: '平均セッション',
    longestSession: '最長セッション',
    currentStreak: '現在の連続日数',
    longestStreak: '最長の連続日数',
    streakValue: ({ days }: { days: number }) => `${days} 日`,
    firstSession: '初回視聴',
    lastSession: '最終視聴',
    dayOfMonthLabel: ({ day }: { day: number }) => `${day}日`
  }
} satisfies Messages['movie']
