/**
 * Game launcher: launch/stop outcome notifications and the launcher file
 * picker. Confirmed launches and stops are reported by the play button state,
 * so only the unexpected outcomes have copy here.
 */
export const launcher = {
  launchCancelledTitle: 'Launch cancelled',
  launchFailedTitle: 'Could not launch the game',
  launchRequestedTitle: 'Launch request sent',
  stopFailedTitle: 'Could not stop the game',
  stopRequestedTitle: 'Stop request sent',

  filePickerTitle: 'Select launch file',
  filePickerButton: 'Select',

  monitorUnavailable: 'Process detection could not start. Check the monitor configuration.',
  processNotDetected: 'No game process detected yet. Check the monitor configuration.',
  stopNotConfirmed: 'The game process has not been confirmed as stopped.',

  errors: {
    gameNotFound: 'The game does not exist.',
    launcherPathNotSet: 'The launch path is not set.',
    fileNotFound: 'The launch file does not exist.',
    executableNotFound: 'The launch program does not exist.',
    openFileFailed: 'Could not open the launch file.',
    invalidUrl: 'The launch URL format is invalid.',
    unknownMode: 'Unknown launch mode.',
    gameNotRunning: 'The game is not running.',
    stopProcessFailed: 'Could not stop the game process.'
  }
}
