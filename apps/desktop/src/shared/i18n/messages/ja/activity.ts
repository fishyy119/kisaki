import type { Messages } from '../schema'

/**
 * Media activity: launch/stop and watch outcome notifications plus the launch
 * file picker. Confirmed outcomes are reported by the action button state, so
 * only the unexpected ones have copy here.
 */
export const activity = {
  launchCancelledTitle: '起動をキャンセルしました',
  launchFailedTitle: 'ゲームを起動できませんでした',
  launchRequestedTitle: '起動リクエストを送信しました',
  stopFailedTitle: 'ゲームを停止できませんでした',
  stopRequestedTitle: '停止リクエストを送信しました',
  watchFailedTitle: '再生を開始できませんでした',
  watchStopFailedTitle: '再生を停止できませんでした',
  readFailedTitle: '読書を開始できませんでした',

  filePickerTitle: '起動ファイルを選択',
  filePickerButton: '選択',

  monitorUnavailable: 'プロセス検出を開始できません。モニター設定を確認してください。',
  processNotDetected: 'ゲームプロセスをまだ検出できていません。モニター設定を確認してください。',
  stopNotConfirmed: 'ゲームプロセスの停止をまだ確認できていません',

  errors: {
    gameNotFound: 'ゲームが存在しません',
    launcherPathNotSet: '起動パスが設定されていません',
    fileNotFound: 'ファイルが存在しません',
    executableNotFound: '起動プログラムが存在しません',
    openFileFailed: '起動ファイルを開けませんでした',
    invalidUrl: '起動 URL の形式が正しくありません',
    gameNotRunning: 'ゲームは実行されていません',
    stopProcessFailed: 'ゲームプロセスを停止できませんでした',
    alreadyWatching: 'この項目はすでに再生中です',
    alreadyPlaying: 'この特典はすでに再生中です',
    notPlaying: '現在再生中のものはありません',
    animeNotFound: 'アニメが存在しません',
    episodeNotFound: 'エピソードが存在しません',
    extraNotFound: '特典が存在しません',
    noExtraFile: 'この特典には動画ファイルがありません',
    noPlayableEpisode: '再生できるエピソードがありません',
    noEpisodeFile: 'このエピソードには動画ファイルがありません',
    playerUnavailable: '動画プレイヤーを利用できません',
    playerStartFailed: '動画プレイヤーを起動できませんでした',
    notWatching: '現在再生中のものはありません',
    stopFailed: '動画プレイヤーを停止できませんでした',
    comicNotFound: 'マンガが存在しません',
    chapterNotFound: 'ユニットが存在しません',
    noReadableChapter: '読み込めるファイルを持つユニットがまだありません',
    noChapterFile: 'このユニットには読み込めるファイルがありません',
    novelNotFound: '小説が存在しません',
    volumeNotFound: '巻が存在しません',
    noReadableVolume: '読み込めるファイルを持つ巻がまだありません',
    noVolumeFile: 'この巻には読み込めるファイルがありません'
  }
} satisfies Messages['activity']
