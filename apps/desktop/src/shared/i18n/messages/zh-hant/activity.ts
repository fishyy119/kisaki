import type { Messages } from '../schema'

/**
 * Media activity: launch/stop and watch outcome notifications plus the launch
 * file picker. Confirmed outcomes are reported by the action button state, so
 * only the unexpected ones have copy here.
 */
export const activity = {
  launchCancelledTitle: '已取消啟動',
  launchFailedTitle: '啟動遊戲失敗',
  launchRequestedTitle: '啟動請求已送出',
  stopFailedTitle: '停止遊戲失敗',
  stopRequestedTitle: '停止請求已送出',
  watchFailedTitle: '開始播放失敗',
  watchStopFailedTitle: '停止播放失敗',

  filePickerTitle: '選擇啟動檔案',
  filePickerButton: '選擇',

  monitorUnavailable: '無法開始處理程序偵測，請檢查監控設定。',
  processNotDetected: '尚未偵測到遊戲處理程序，請檢查監控設定。',
  stopNotConfirmed: '尚未確認遊戲處理程序已停止。',

  errors: {
    gameNotFound: '遊戲不存在。',
    launcherPathNotSet: '啟動路徑未設定。',
    fileNotFound: '檔案不存在。',
    executableNotFound: '啟動程式不存在。',
    openFileFailed: '開啟啟動檔案失敗。',
    invalidUrl: '啟動連結格式不正確。',
    gameNotRunning: '遊戲未執行。',
    stopProcessFailed: '停止遊戲處理程序失敗。',
    alreadyWatching: '該動漫已在播放中。',
    animeNotFound: '動漫不存在。',
    episodeNotFound: '劇集不存在。',
    extraNotFound: '特典不存在。',
    noExtraFile: '該特典尚無影片檔案。',
    noPlayableEpisode: '沒有可播放的劇集。',
    noEpisodeFile: '該劇集尚無影片檔案。',
    playerUnavailable: '影片播放器無法使用。',
    playerStartFailed: '啟動影片播放器失敗。',
    notWatching: '目前沒有正在播放的內容。',
    stopFailed: '停止影片播放器失敗。'
  }
} satisfies Messages['activity']
