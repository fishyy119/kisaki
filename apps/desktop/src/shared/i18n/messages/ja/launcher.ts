import type { Messages } from '../schema'

/** Game launcher: launch/stop notifications owned by the main process. */
export const launcher = {
  launching: 'ゲームを起動しています',
  launchCancelledTitle: '起動をキャンセルしました',
  launchFailedTitle: 'ゲームを起動できませんでした',
  launchedTitle: 'ゲームを起動しました',
  launchRequestedTitle: '起動リクエストを送信しました',
  stopping: 'ゲームを停止しています',
  stopFailedTitle: 'ゲームを停止できませんでした',
  stoppedTitle: 'ゲームを停止しました',
  stopRequestedTitle: '停止リクエストを送信しました',

  filePickerTitle: '起動ファイルを選択',
  filePickerButton: '選択',

  monitorUnavailable: 'プロセス検出を開始できません。モニター設定を確認してください。',
  processNotDetected: 'ゲームプロセスをまだ検出できていません。モニター設定を確認してください。',
  stopNotConfirmed: 'ゲームプロセスの停止をまだ確認できていません。',

  errors: {
    gameNotFound: 'ゲームが存在しません。',
    launcherPathNotSet: '起動パスが設定されていません。',
    fileNotFound: '起動ファイルが存在しません。',
    executableNotFound: '起動プログラムが存在しません。',
    openFileFailed: '起動ファイルを開けませんでした。',
    invalidUrl: '起動 URL の形式が正しくありません。',
    unknownMode: '不明な起動方式です。',
    gameNotRunning: 'ゲームは実行されていません。',
    stopProcessFailed: 'ゲームプロセスを停止できませんでした。'
  }
} satisfies Messages['launcher']
