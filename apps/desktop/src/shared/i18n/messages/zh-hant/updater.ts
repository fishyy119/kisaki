import type { Messages } from '../schema'

export const updater = {
  updateDownloaded: '更新已下載',
  newVersionFound: ({ version }: { version: string }) => `發現新版本 v${version}`,
  updateAvailable: '有可用的更新',

  dialog: {
    title: '軟體更新',
    checking: '正在檢查更新…',
    downloading: '正在下載更新…',
    idleHint: '點選「檢查更新」開始。',
    newVersionAvailable: '發現新版本',
    downloaded: '更新已下載',
    upToDate: '目前已是最新版本。',
    failed: '更新失敗',
    failedWithReason: ({ message }: { message: string }) => `更新失敗：${message}`,
    releasedAt: ({ date }: { date: string }) => `發佈於 ${date}`,
    checkFailed: '檢查更新失敗',
    downloadFailed: '下載更新失敗',
    installFailed: '安裝更新失敗',
    changelogLoadFailed: '取得更新日誌失敗',
    downloadProgress: '下載進度',
    changelogLabel: '更新日誌',
    changelogLoading: '正在載入更新日誌…',
    changelogError: ({ message }: { message: string }) => `更新日誌載入失敗：${message}`,
    changelogEmpty: '目前語言暫無更新日誌。',
    changelogPlaceholder: '檢查到更新後會在此顯示更新日誌。',
    checkUpdates: '檢查更新',
    startDownload: '開始下載',
    installAndRestart: '更新並重新啟動'
  },

  run: {
    checkTitle: '檢查應用程式更新',
    downloadTitle: ({ version }: { version: string }) => `下載應用程式更新 v${version}`,
    checkingPhase: '正在檢查應用程式更新',
    downloadingPhase: '正在下載應用程式更新',
    foundTitle: '發現新版本',
    foundSummary: ({ version }: { version: string }) => `發現應用程式更新 v${version}。`,
    upToDateTitle: '目前已是最新版本',
    upToDateSummary: '沒有發現可用的應用程式更新。',
    checkCancelledSummary: '應用程式更新檢查已取消。',
    downloadedTitle: '應用程式更新下載完成',
    downloadedSummary: ({ version }: { version: string }) => `已下載應用程式更新 v${version}。`,
    downloadedSummaryNoVersion: '應用程式更新已下載。',
    downloadCancelledSummary: '應用程式更新下載已取消。'
  }
} satisfies Messages['updater']
