import type { Messages } from '../schema'

export const anime = {
  watch: '觀看',
  watchNext: '看下一集',
  stop: '停止',
  starting: '啟動中',
  stopping: '停止中',
  playing: '播放中',

  episodes: {
    title: '劇集',
    emptyTitle: '尚無劇集',
    emptyHint: '掃描動漫資料夾或抓取中繼資料後，劇集會出現在這裡。',
    unnamed: ({ number }: { number: string }) => `第 ${number} 話`,
    watched: '已看',
    unwatched: '未看',
    missingFile: '缺少檔案',
    fileCount: ({ count }: { count: number }) => `${count} 個檔案`,
    resumeAt: ({ position }: { position: string }) => `從 ${position} 繼續`,
    markWatched: '標記為已看',
    markUnwatched: '標記為未看',
    watchedUpdated: '觀看狀態已更新。',
    progress: ({ watched, total }: { watched: number; total: number }) =>
      `已看 ${watched} / ${total}`
  },

  extras: {
    title: '特典',
    emptyTitle: '尚無特典',
    emptyHint: '資料夾中的預告片、無字 OP/ED 會出現在這裡。'
  },

  files: {
    title: '檔案',
    primary: '首選',
    resolution: '解析度',
    codec: '編碼',
    audioTracks: '音軌',
    subtitleTracks: '字幕軌',
    openFolder: '開啟所在資料夾',
    openFolderFailed: '無法開啟所在資料夾。'
  },

  player: {
    pause: '暫停',
    resume: '繼續播放',
    paused: '已暫停',
    pauseFailed: '無法暫停播放。',
    resumeFailed: '無法繼續播放。'
  },

  detail: {
    openAnimeDir: '開啟動漫資料夾',
    animeDirNotSet: '尚未設定動漫資料夾。',
    watchStatus: '觀看狀態'
  },

  activity: {
    emptyTitle: '尚無觀看紀錄',
    emptyHint: '開始播放劇集後，觀看時長會自動記錄在這裡。',
    watchDuration: '觀看時長',
    sessionCount: '觀看次數',
    lastWatched: '最近觀看'
  }
} satisfies Messages['anime']
