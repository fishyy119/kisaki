import type { Messages } from '../schema'

export const anime = {
  watch: '观看',
  watchNext: '看下一集',
  stop: '停止',
  starting: '启动中',
  stopping: '停止中',
  playing: '播放中',

  episodes: {
    title: '剧集',
    emptyTitle: '暂无剧集',
    emptyHint: '扫描动漫目录或刮削元数据后，剧集会出现在这里。',
    unnamed: ({ number }: { number: string }) => `第 ${number} 话`,
    watched: '已看',
    unwatched: '未看',
    missingFile: '缺少文件',
    fileCount: ({ count }: { count: number }) => `${count} 个文件`,
    resumeAt: ({ position }: { position: string }) => `从 ${position} 继续`,
    markWatched: '标记为已看',
    markUnwatched: '标记为未看',
    watchedUpdated: '观看状态已更新。',
    progress: ({ watched, total }: { watched: number; total: number }) =>
      `已看 ${watched} / ${total}`
  },

  extras: {
    title: '特典',
    emptyTitle: '暂无特典',
    emptyHint: '目录中的预告片、无字 OP/ED 会出现在这里。'
  },

  files: {
    title: '文件',
    primary: '首选',
    resolution: '分辨率',
    codec: '编码',
    audioTracks: '音轨',
    subtitleTracks: '字幕轨',
    openFolder: '打开所在文件夹',
    openFolderFailed: '无法打开所在文件夹。'
  },

  player: {
    pause: '暂停',
    resume: '继续播放',
    paused: '已暂停',
    pauseFailed: '无法暂停播放。',
    resumeFailed: '无法继续播放。'
  },

  detail: {
    openAnimeDir: '打开动漫目录',
    animeDirNotSet: '尚未设置动漫目录。',
    watchStatus: '观看状态'
  },

  activity: {
    emptyTitle: '暂无观看记录',
    emptyHint: '开始播放剧集后，观看时长会自动记录在这里。',
    watchDuration: '观看时长',
    sessionCount: '观看次数',
    lastWatched: '最近观看'
  }
} satisfies Messages['anime']
