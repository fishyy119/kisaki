/**
 * TV-specific surfaces: watch button, season-grouped episode list, extras, and
 * the playback controls shown while an episode is playing.
 */
export const tv = {
  watchStart: 'Start watching',
  watchContinue: 'Continue watching',
  watchNext: 'Watch next',
  stop: 'Stop',
  showDetail: 'Show details',

  seasons: {
    title: 'Seasons',
    entityLabel: 'Season',
    specials: 'Specials',
    unnamed: ({ number }: { number: number }) => `Season ${number}`,
    seasonCount: ({ count }: { count: number }) => (count === 1 ? '1 season' : `${count} seasons`),
    posterEntityLabel: 'Season poster',
    airDate: 'Air date',
    addSeason: 'Add season',
    editSeason: 'Edit season',
    deleteSeason: 'Delete season',
    seasonDeleted: 'Season deleted.',
    numberLabel: 'Season number',
    numberHint: 'Use 0 for specials.',
    numberInvalid: 'The season number must be zero or greater.',
    numberTaken: 'That season number is already used.',
    nameLabel: 'Title',
    namePlaceholder: 'Optional',
    collapseAll: 'Collapse all',
    expandAll: 'Expand all'
  },

  episodes: {
    title: 'Episodes',
    emptyTitle: 'No episodes yet',
    emptyHint: 'Scan the show folder or scrape metadata to build the episode list.',
    unnamed: ({ number }: { number: string }) => `Episode ${number}`,
    code: ({ season, episode }: { season: number; episode: string }) =>
      `S${String(season).padStart(2, '0')}E${episode.padStart(2, '0')}`,
    entityLabel: 'Episode',
    watched: 'Watched',
    unwatched: 'Unwatched',
    stillEntityLabel: 'Still',
    resumeAt: ({ position }: { position: string }) => `Resume at ${position}`,
    markWatched: 'Mark as watched',
    markUnwatched: 'Mark as unwatched',
    watchedUpdated: 'Watch state updated.',
    progress: ({ watched, total }: { watched: number; total: number }) =>
      `${watched} / ${total} watched`,
    playCount: 'Play count',
    watchedAt: 'Watched at',
    resumeLabel: 'Resume position',
    airDate: 'Air date',

    catchUp: {
      title: 'Mark remaining episodes as watched?',
      pendingCount: ({ count }: { count: number }) =>
        count === 1
          ? '1 episode is not marked as watched.'
          : `${count} episodes are not marked as watched.`,
      pendingByType: {
        regular: ({ count }: { count: number }) =>
          count === 1 ? '1 regular episode' : `${count} regular episodes`,
        special: ({ count }: { count: number }) => (count === 1 ? '1 special' : `${count} specials`)
      },
      hint: 'Marking records the watch state only, without a playback time.',
      markAll: 'Mark all',
      markRegularOnly: 'Episodes only',
      skip: 'Skip',
      marked: ({ count }: { count: number }) =>
        count === 1 ? '1 episode marked as watched.' : `${count} episodes marked as watched.`
    },

    addEpisode: 'Add episode',
    editEpisode: 'Edit episode',
    deleteEpisode: 'Delete episode',
    episodeDeleted: 'Episode deleted.',
    numberLabel: 'Number',
    numberPlaceholder: 'Optional',
    seasonLabel: 'Season',
    durationMinutes: 'Duration (minutes)',
    numberInvalid: 'The episode number must be positive.',
    durationInvalid: 'The duration must be positive.',

    syncFiles: 'Sync files',
    syncCompleted: ({
      seasons,
      episodes,
      files,
      extras
    }: {
      seasons: number
      episodes: number
      files: number
      extras: number
    }) => `Synced ${seasons} seasons, ${episodes} episodes, ${files} files, and ${extras} extras.`,
    syncFailed: 'File sync failed.',
    syncUnrecognized: ({ count }: { count: number }) =>
      count === 1
        ? '1 file has no readable season and episode number.'
        : `${count} files have no readable season and episode number.`
  },

  extras: {
    title: 'Extras',
    emptyTitle: 'No extras yet',
    emptyHint: 'Trailers and behind-the-scenes clips found in the folder show up here.',
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
    title: 'Files',
    playFile: 'Play this file',
    missingFile: 'No file',
    noFiles: 'No files yet.',
    fileCount: ({ count }: { count: number }) => (count === 1 ? '1 file' : `${count} files`),
    primary: 'Primary',
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
    noteSaved: 'Note saved.'
  },

  player: {
    pause: 'Pause',
    resume: 'Resume',
    pauseFailed: 'Could not pause playback.',
    resumeFailed: 'Could not resume playback.'
  },

  detail: {
    openTvDir: 'Open show folder',
    tvDirNotSet: 'The show folder is not set.',
    watchStatus: 'Watch status'
  },

  filesConfig: {
    title: 'Files configuration',
    tvDirLabel: 'Show folder',
    tvDirPlaceholder: 'Not set',
    selectDir: 'Select folder',
    tvDirHint:
      'File sync scans this folder to match episode files by their SxxEyy numbering; leave it empty for fully manual file management. Saving a change re-syncs files.'
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
    emptyHint: 'Watch time is recorded here automatically once you start an episode.',
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
