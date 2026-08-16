/**
 * Movie-specific surfaces: watch button, release files, extras, and the
 * playback controls shown while the feature is playing.
 */
export const movie = {
  watchStart: 'Watch',
  watchContinue: 'Continue watching',
  watchAgain: 'Watch again',
  stop: 'Stop',
  showDetail: 'Show details',

  watch: {
    watched: 'Watched',
    unwatched: 'Unwatched',
    markWatched: 'Mark as watched',
    markUnwatched: 'Mark as unwatched',
    watchedUpdated: 'Watch state updated.',
    resumeAt: ({ position }: { position: string }) => `Resume at ${position}`,
    clearResume: 'Clear resume position',
    resumeCleared: 'Resume position cleared.',
    playCount: 'Play count',
    watchedAt: 'Watched at',
    resumeLabel: 'Resume position',
    runtime: 'Runtime'
  },

  extras: {
    title: 'Extras',
    emptyTitle: 'No extras yet',
    emptyHint: 'Trailers and deleted scenes found in the folder show up here.',
    entityLabel: 'Extra',
    addExtra: 'Add extra',
    extraAttached: 'Extra added',
    editTitle: 'Edit extra',
    extraUpdated: 'Extra updated',
    deleteExtra: 'Delete extra',
    extraRemoved: 'Extra record removed',
    play: 'Play',
    playFailed: 'Failed to play extra',
    stopFailed: 'Failed to stop extra',
    nameLabel: 'Name',
    typeLabel: 'Type',
    autoDetect: 'Auto detect'
  },

  files: {
    title: 'Releases',
    emptyTitle: 'No files yet',
    emptyHint: 'Scan the movie folder or attach a file to make the movie playable.',
    playFile: 'Play this file',
    missingFile: 'No file',
    noFiles: 'No files yet.',
    fileCount: ({ count }: { count: number }) => (count === 1 ? '1 file' : `${count} files`),
    primary: 'Primary',
    editionLabel: 'Edition',
    editionPlaceholder: 'Theatrical, Director\u2019s Cut\u2026',
    editionSaved: 'Edition saved.',
    resolution: 'Resolution',
    codec: 'Codec',
    audioTracks: 'Audio tracks',
    subtitleTracks: 'Subtitle tracks',
    audioTrackCount: ({ count }: { count: number }) =>
      count === 1 ? '1 audio track' : `${count} audio tracks`,
    subtitleTrackCount: ({ count }: { count: number }) =>
      count === 1 ? '1 subtitle track' : `${count} subtitle tracks`,
    openFolder: 'Open containing folder',
    openFolderFailed: 'Could not open the containing folder.',
    setPrimary: 'Set as primary',
    primaryUpdated: 'Primary file updated.',
    removeFile: 'Remove file record',
    fileRemoved: 'File record removed.',
    recordEntityLabel: 'file record',
    addFile: 'Add file',
    fileAttached: 'File attached.',
    attachFailed: 'Could not attach the file.',
    manualBadge: 'Manual',
    noteLabel: 'Note',
    editNote: 'Edit note',
    noteSaved: 'Note saved.',

    syncFiles: 'Sync files',
    syncCompleted: ({ files, extras }: { files: number; extras: number }) =>
      `Synced ${files} files and ${extras} extras.`,
    syncFailed: 'File sync failed.'
  },

  player: {
    pause: 'Pause',
    resume: 'Resume',
    pauseFailed: 'Could not pause playback.',
    resumeFailed: 'Could not resume playback.'
  },

  detail: {
    openMovieDir: 'Open movie folder',
    movieDirNotSet: 'The movie folder is not set.',
    watchStatus: 'Watch status'
  },

  filesConfig: {
    title: 'Files configuration',
    movieDirLabel: 'Movie folder',
    movieDirPlaceholder: 'Not set',
    selectDir: 'Select folder',
    movieDirHint:
      'File sync scans this folder for releases of the feature and for extras; leave it empty for fully manual file management. Saving a change re-syncs files.'
  },

  statusDialog: {
    title: 'Edit watch status',
    label: 'Watch status',
    selectStatus: 'Select status'
  },

  lastActiveDialog: {
    title: 'Edit last watched time',
    label: 'Last watched time',
    emptyHint: 'Leave empty for never watched.'
  },

  duration: {
    title: 'Edit watch time',
    totalTime: 'Total watch time',
    sessionsDuration: ({ value }: { value: string }) => `Sessions: ${value}`,
    untrackedDuration: ({ value }: { value: string }) => `Untracked: ${value}`,
    untrackedLabel: 'Untracked watch time',
    hoursUnit: 'hours',
    minutesUnit: 'minutes',
    untrackedHint: 'Watch time not covered by sessions (such as imported history).',
    sessionsHeader: ({ count }: { count: number }) => `Sessions (${count})`,
    emptySessions: 'No session records yet. Add one below.',
    addRecord: 'Add record',
    editRecord: 'Edit record',
    startTime: 'Start time',
    endTime: 'End time',
    startEndRequired: 'Fill in both start and end times.',
    endAfterStart: 'The end time must be after the start time.',
    overlap: 'The time range overlaps an existing record.',
    recordAdded: 'Record added',
    recordUpdated: 'Record updated',
    recordDeleted: 'Record deleted',
    deleteRecordDescription: 'Delete this session record? This cannot be undone.'
  },

  activity: {
    emptyTitle: 'No watch activity yet',
    emptyHint: 'Watch time is recorded here automatically once you start the movie.',
    statsOverview: 'Stats overview',
    heatmap: 'Activity heatmap',
    trend: 'Watch trend',
    distribution: 'Time distribution',
    recentSessions: 'Recent sessions',
    totalDuration: 'Watch time',
    sessionCount: 'Sessions',
    sessionCountValue: ({ count }: { count: number }) =>
      count === 1 ? '1 session' : `${count} sessions`,
    avgDuration: 'Average session',
    longestSession: 'Longest session',
    currentStreak: 'Current streak',
    longestStreak: 'Longest streak',
    streakValue: ({ days }: { days: number }) => (days === 1 ? '1 day' : `${days} days`),
    firstSession: 'First watched',
    lastSession: 'Last watched',
    dayOfMonthLabel: ({ day }: { day: number }) => `Day ${day}`
  }
}
