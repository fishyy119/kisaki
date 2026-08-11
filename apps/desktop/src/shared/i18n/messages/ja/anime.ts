import type { Messages } from '../schema'

export const anime = {
  watch: '視聴',
  watchNext: '次の話を見る',
  stop: '停止',
  starting: '起動中',
  stopping: '停止中',
  playing: '再生中',

  episodes: {
    title: 'エピソード',
    emptyTitle: 'エピソードがありません',
    emptyHint: 'フォルダーをスキャンするかメタデータを取得すると、ここに表示されます。',
    unnamed: ({ number }: { number: string }) => `第${number}話`,
    watched: '視聴済み',
    unwatched: '未視聴',
    missingFile: 'ファイルなし',
    fileCount: ({ count }: { count: number }) => `${count} ファイル`,
    resumeAt: ({ position }: { position: string }) => `${position} から再開`,
    markWatched: '視聴済みにする',
    markUnwatched: '未視聴にする',
    watchedUpdated: '視聴状態を更新しました。',
    progress: ({ watched, total }: { watched: number; total: number }) =>
      `${watched} / ${total} 視聴済み`
  },

  extras: {
    title: '特典',
    emptyTitle: '特典がありません',
    emptyHint: 'フォルダー内の予告編やノンクレジット OP/ED がここに表示されます。'
  },

  files: {
    title: 'ファイル',
    primary: '優先',
    resolution: '解像度',
    codec: 'コーデック',
    audioTracks: '音声トラック',
    subtitleTracks: '字幕トラック',
    openFolder: '格納フォルダーを開く',
    openFolderFailed: '格納フォルダーを開けませんでした。'
  },

  player: {
    pause: '一時停止',
    resume: '再開',
    paused: '一時停止中',
    pauseFailed: '再生を一時停止できませんでした。',
    resumeFailed: '再生を再開できませんでした。'
  },

  detail: {
    openAnimeDir: 'アニメフォルダーを開く',
    animeDirNotSet: 'アニメフォルダーが設定されていません。',
    watchStatus: '視聴ステータス'
  },

  activity: {
    emptyTitle: '視聴記録がありません',
    emptyHint: 'エピソードを再生すると、視聴時間が自動で記録されます。',
    watchDuration: '視聴時間',
    sessionCount: '視聴回数',
    lastWatched: '最終視聴'
  }
} satisfies Messages['anime']
