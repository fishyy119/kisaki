import type { Messages } from '../schema'

export const updater = {
  updateDownloaded: '更新已下载',
  newVersionFound: ({ version }: { version: string }) => `发现新版本 v${version}`,
  updateAvailable: '有可用的更新',

  dialog: {
    title: '软件更新',
    checking: '正在检查更新…',
    downloading: '正在下载更新…',
    idleHint: '点击“检查更新”开始。',
    newVersionAvailable: '发现新版本',
    downloaded: '更新已下载',
    upToDate: '当前已是最新版本。',
    failed: '更新失败',
    failedWithReason: ({ message }: { message: string }) => `更新失败：${message}`,
    releasedAt: ({ date }: { date: string }) => `发布于 ${date}`,
    checkFailed: '检查更新失败',
    downloadFailed: '下载更新失败',
    installFailed: '安装更新失败',
    changelogLoadFailed: '获取更新日志失败',
    downloadProgress: '下载进度',
    changelogLabel: '更新日志',
    changelogLoading: '正在加载更新日志…',
    changelogError: ({ message }: { message: string }) => `更新日志加载失败：${message}`,
    changelogEmpty: '当前语言暂无更新日志。',
    changelogPlaceholder: '检查到更新后会在此显示更新日志。',
    checkUpdates: '检查更新',
    startDownload: '开始下载',
    installAndRestart: '更新并重启'
  },

  run: {
    checkTitle: '检查应用更新',
    downloadTitle: ({ version }: { version: string }) => `下载应用更新 v${version}`,
    checkingPhase: '正在检查应用更新',
    downloadingPhase: '正在下载应用更新',
    foundTitle: '发现新版本',
    foundSummary: ({ version }: { version: string }) => `发现应用更新 v${version}。`,
    upToDateTitle: '当前已是最新版本',
    upToDateSummary: '没有发现可用应用更新。',
    checkCancelledSummary: '应用更新检查已取消。',
    downloadedTitle: '应用更新下载完成',
    downloadedSummary: ({ version }: { version: string }) => `已下载应用更新 v${version}。`,
    downloadedSummaryNoVersion: '应用更新已下载。',
    downloadCancelledSummary: '应用更新下载已取消。'
  }
} satisfies Messages['updater']
