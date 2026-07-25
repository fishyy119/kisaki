/** Game launcher: launch/stop notifications owned by the main process. */
export const launcher = {
  launching: 'Launching the game',
  launchCancelledTitle: 'Launch cancelled',
  launchFailedTitle: 'Could not launch the game',
  launchedTitle: 'Game launched',
  launchRequestedTitle: 'Launch request sent',
  stopping: 'Stopping the game',
  stopFailedTitle: 'Could not stop the game',
  stoppedTitle: 'Game stopped',
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
