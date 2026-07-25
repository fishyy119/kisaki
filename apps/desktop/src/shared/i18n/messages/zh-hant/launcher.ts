import type { Messages } from '../schema'

/** Game launcher: launch/stop notifications owned by the main process. */
export const launcher = {
  launching: '正在啟動遊戲',
  launchCancelledTitle: '已取消啟動',
  launchFailedTitle: '啟動遊戲失敗',
  launchedTitle: '已啟動遊戲',
  launchRequestedTitle: '啟動請求已送出',
  stopping: '正在停止遊戲',
  stopFailedTitle: '停止遊戲失敗',
  stoppedTitle: '已停止遊戲',
  stopRequestedTitle: '停止請求已送出',

  filePickerTitle: '選擇啟動檔案',
  filePickerButton: '選擇',

  monitorUnavailable: '無法開始處理程序偵測，請檢查監控設定。',
  processNotDetected: '尚未偵測到遊戲處理程序，請檢查監控設定。',
  stopNotConfirmed: '尚未確認遊戲處理程序已停止。',

  errors: {
    gameNotFound: '遊戲不存在。',
    launcherPathNotSet: '啟動路徑未設定。',
    fileNotFound: '啟動檔案不存在。',
    executableNotFound: '啟動程式不存在。',
    openFileFailed: '開啟啟動檔案失敗。',
    invalidUrl: '啟動連結格式不正確。',
    unknownMode: '未知啟動方式。',
    gameNotRunning: '遊戲未執行。',
    stopProcessFailed: '停止遊戲處理程序失敗。'
  }
} satisfies Messages['launcher']
