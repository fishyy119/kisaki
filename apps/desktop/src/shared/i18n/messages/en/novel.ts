/**
 * Novel-specific surfaces: read button, volume list, and the book files
 * behind each volume.
 */
export const novel = {
  readStart: 'Start reading',
  readContinue: 'Continue reading',
  stop: 'Stop',
  volumes: {
    title: 'Volumes',
    emptyTitle: 'No volumes yet',
    emptyHint: 'Scan the novel folder or scrape metadata to build the volume list',
    unnamed: ({ number }: { number: string }) => `Volume ${number}`,
    entityLabel: 'Volume',
    read: 'Read',
    unread: 'Unread',
    resumeProgress: ({ percent }: { percent: number }) => `Resume at ${percent}%`,
    markRead: 'Mark as read',
    markUnread: 'Mark as unread',
    readUpdated: 'Read state updated',
    progress: ({ read, total }: { read: number; total: number }) => `${read} / ${total} read`,
    readCount: 'Read count',
    readAt: 'Read at',
    releaseDate: 'Release date',

    catchUp: {
      title: 'Mark remaining volumes as read?',
      pendingCount: ({ count }: { count: number }) =>
        count === 1 ? '1 volume is not marked as read' : `${count} volumes are not marked as read`,
      hint: 'Marking records the read state only, without a reading time',
      markAll: 'Mark all',
      skip: 'Skip',
      marked: ({ count }: { count: number }) =>
        count === 1 ? '1 volume marked as read' : `${count} volumes marked as read`
    },

    addVolume: 'Add volume',
    editVolume: 'Edit volume',
    deleteVolume: 'Delete volume',
    volumeDeleted: 'Volume deleted',
    numberLabel: 'Volume number',
    numberPlaceholder: 'Optional',
    numberInvalid: 'The volume number must be positive',
    numberRequired: 'A volume needs a number or a name',

    syncFiles: 'Sync files',
    syncCompleted: ({ volumes, files }: { volumes: number; files: number }) =>
      `Synced ${volumes} volumes and ${files} files`,
    syncFailed: 'File sync failed',
    syncUnrecognized: ({ count }: { count: number }) =>
      count === 1
        ? '1 file has no readable volume number'
        : `${count} files have no readable volume number`
  },

  files: {
    title: 'Files',
    readFile: 'Read this file',
    missingFile: 'No file',
    noFiles: 'No files yet',
    fileCount: ({ count }: { count: number }) => (count === 1 ? '1 file' : `${count} files`),
    primary: 'Primary',
    openFolder: 'Open containing folder',
    openFolderFailed: 'Could not open the containing folder',
    setPrimary: 'Set as primary',
    primaryUpdated: 'Primary file updated',
    removeFile: 'Remove file record',
    fileRemoved: 'File record removed',
    recordEntityLabel: 'file record',
    addFile: 'Add file',
    fileAttached: 'File attached',
    attachFailed: 'Could not attach the file',
    manualBadge: 'Manual',
    noteLabel: 'Note',
    editNote: 'Edit note',
    noteSaved: 'Note saved'
  },

  detail: {
    openNovelDir: 'Open novel folder',
    novelDirNotSet: 'The novel folder is not set',
    readStatus: 'Read status'
  },

  filesConfig: {
    title: 'Files configuration',
    novelDirLabel: 'Novel folder',
    novelDirPlaceholder: 'Not set',
    selectDir: 'Select folder',
    novelDirHint:
      'File sync scans this folder to match volume files; leave it empty for fully manual file management. Saving a change re-syncs files.'
  },

  statusDialog: {
    title: 'Edit read status',
    label: 'Read status',
    selectStatus: 'Select status'
  },

  lastActiveDialog: {
    title: 'Edit last read time',
    label: 'Last read time',
    emptyHint: 'Leave empty for never read'
  },

  duration: {
    title: 'Edit reading time',
    totalTime: 'Total reading time',
    sessionsDuration: ({ value }: { value: string }) => `Sessions: ${value}`,
    untrackedDuration: ({ value }: { value: string }) => `Untracked: ${value}`,
    untrackedLabel: 'Untracked reading time',
    hoursUnit: 'hours',
    minutesUnit: 'minutes',
    untrackedHint: 'Reading time not covered by sessions (such as imported history)',
    sessionsHeader: ({ count }: { count: number }) => `Sessions (${count})`,
    emptySessions: 'No session records yet. Add one below.',
    addRecord: 'Add record',
    editRecord: 'Edit record',
    startTime: 'Start time',
    endTime: 'End time',
    startEndRequired: 'Fill in both start and end times',
    endAfterStart: 'The end time must be after the start time',
    overlap: 'The time range overlaps an existing record',
    recordAdded: 'Record added',
    recordUpdated: 'Record updated',
    recordDeleted: 'Record deleted',
    deleteRecordDescription: 'Delete this session record? This cannot be undone.'
  },

  activity: {
    emptyTitle: 'No reading activity yet',
    emptyHint: 'Reading time is recorded here automatically once you open a volume',
    statsOverview: 'Stats overview',
    heatmap: 'Activity heatmap',
    trend: 'Reading trend',
    distribution: 'Time distribution',
    recentSessions: 'Recent sessions',
    totalDuration: 'Reading time',
    sessionCount: 'Sessions',
    sessionCountValue: ({ count }: { count: number }) =>
      count === 1 ? '1 session' : `${count} sessions`,
    avgDuration: 'Average session',
    longestSession: 'Longest session',
    currentStreak: 'Current streak',
    longestStreak: 'Longest streak',
    streakValue: ({ days }: { days: number }) => (days === 1 ? '1 day' : `${days} days`),
    firstSession: 'First read',
    lastSession: 'Last read',
    dayOfMonthLabel: ({ day }: { day: number }) => `Day ${day}`
  }
}
