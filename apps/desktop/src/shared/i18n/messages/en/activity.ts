/**
 * Media activity: launch/stop and watch outcome notifications plus the launch
 * file picker. Confirmed outcomes are reported by the action button state, so
 * only the unexpected ones have copy here.
 */
export const activity = {
  launchCancelledTitle: 'Launch cancelled',
  launchFailedTitle: 'Could not launch the game',
  launchRequestedTitle: 'Launch request sent',
  stopFailedTitle: 'Could not stop the game',
  stopRequestedTitle: 'Stop request sent',
  watchFailedTitle: 'Could not start playback',
  watchStopFailedTitle: 'Could not stop playback',

  filePickerTitle: 'Select launch file',
  filePickerButton: 'Select',

  monitorUnavailable: 'Process detection could not start. Check the monitor configuration.',
  processNotDetected: 'No game process detected yet. Check the monitor configuration.',
  stopNotConfirmed: 'The game process has not been confirmed as stopped.',

  errors: {
    gameNotFound: 'The game does not exist.',
    launcherPathNotSet: 'The launch path is not set.',
    fileNotFound: 'The file no longer exists.',
    executableNotFound: 'The launch program does not exist.',
    openFileFailed: 'Could not open the launch file.',
    invalidUrl: 'The launch URL format is invalid.',
    gameNotRunning: 'The game is not running.',
    stopProcessFailed: 'Could not stop the game process.',
    alreadyWatching: 'This anime is already playing.',
    animeNotFound: 'The anime does not exist.',
    episodeNotFound: 'The episode does not exist.',
    noPlayableEpisode: 'There is no episode left to watch.',
    noEpisodeFile: 'The episode has no video file yet.',
    playerUnavailable: 'The video player is not available.',
    playerStartFailed: 'Could not start the video player.',
    notWatching: 'Nothing is playing right now.',
    stopFailed: 'Could not stop the video player.'
  }
}
