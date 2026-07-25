/** App updater: titlebar chip and updater dialog. */
export const updater = {
  updateDownloaded: 'Update downloaded',
  newVersionFound: ({ version }: { version: string }) => `New version v${version} available`,
  updateAvailable: 'Update available',

  dialog: {
    title: 'App update',
    checking: 'Checking for updates…',
    downloading: 'Downloading the update…',
    idleHint: 'Press "Check for updates" to start.',
    newVersionAvailable: 'New version available',
    downloaded: 'Update downloaded',
    upToDate: 'You are on the latest version.',
    failed: 'Update failed',
    failedWithReason: ({ message }: { message: string }) => `Update failed: ${message}`,
    releasedAt: ({ date }: { date: string }) => `Released ${date}`,
    checkFailed: 'Could not check for updates',
    downloadFailed: 'Could not download the update',
    installFailed: 'Could not install the update',
    changelogLoadFailed: 'Could not load the changelog',
    downloadProgress: 'Download progress',
    changelogLabel: 'Changelog',
    changelogLoading: 'Loading the changelog…',
    changelogError: ({ message }: { message: string }) =>
      `Could not load the changelog: ${message}`,
    changelogEmpty: 'No changelog for this language yet.',
    changelogPlaceholder: 'The changelog appears here once an update is found.',
    checkUpdates: 'Check for updates',
    startDownload: 'Download',
    installAndRestart: 'Update and restart'
  },

  run: {
    checkTitle: 'Check for app updates',
    downloadTitle: ({ version }: { version: string }) => `Download app update v${version}`,
    checkingPhase: 'Checking for app updates',
    downloadingPhase: 'Downloading the app update',
    foundTitle: 'New version found',
    foundSummary: ({ version }: { version: string }) => `App update v${version} is available.`,
    upToDateTitle: 'Already up to date',
    upToDateSummary: 'No app updates were found.',
    checkCancelledSummary: 'The app update check was cancelled.',
    downloadedTitle: 'App update downloaded',
    downloadedSummary: ({ version }: { version: string }) => `Downloaded app update v${version}.`,
    downloadedSummaryNoVersion: 'The app update has been downloaded.',
    downloadCancelledSummary: 'The app update download was cancelled.'
  }
}
