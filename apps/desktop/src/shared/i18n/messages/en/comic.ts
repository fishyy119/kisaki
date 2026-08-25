/**
 * Comic-specific surfaces: read button, unit list (volumes and chapters), and
 * the file records behind each unit.
 */
export const comic = {
  readStart: 'Start reading',
  readContinue: 'Continue reading',
  readNext: 'Read next',
  showDetail: 'Show details',

  chapters: {
    title: 'Units',
    emptyTitle: 'No volumes or chapters yet',
    emptyHint: 'Scan the comic folder or scrape metadata to build the unit list',
    unnamedVolume: ({ number }: { number: string }) => `Volume ${number}`,
    unnamedChapter: ({ number }: { number: string }) => `Chapter ${number}`,
    entityLabel: 'Unit',
    read: 'Read',
    unread: 'Unread',
    resumeAt: ({ page }: { page: number }) => `Resume at page ${page}`,
    markRead: 'Mark as read',
    markUnread: 'Mark as unread',
    readUpdated: 'Read state updated',
    progress: ({ read, total }: { read: number; total: number }) => `${read} / ${total} read`,
    readCount: 'Read count',
    readAt: 'Read at',
    releaseDate: 'Release date',
    pageCount: ({ count }: { count: number }) => (count === 1 ? '1 page' : `${count} pages`),

    catchUp: {
      title: 'Mark remaining units as read?',
      pendingCount: ({ count }: { count: number }) =>
        count === 1 ? '1 unit is not marked as read' : `${count} units are not marked as read`,
      hint: 'Marking records the read state only, without a reading time',
      markAll: 'Mark all',
      skip: 'Skip',
      marked: ({ count }: { count: number }) =>
        count === 1 ? '1 unit marked as read' : `${count} units marked as read`
    },

    addChapter: 'Add unit',
    editChapter: 'Edit unit',
    deleteChapter: 'Delete unit',
    chapterDeleted: 'Unit deleted',
    volumeNumberLabel: 'Volume number',
    chapterNumberLabel: 'Chapter number',
    numberPlaceholder: 'Optional',
    numberInvalid: 'The number must be positive',
    numberRequired: 'A unit needs a volume number, a chapter number, or a name',

    syncFiles: 'Sync files',
    syncCompleted: ({ chapters, files }: { chapters: number; files: number }) =>
      `Synced ${chapters} units and ${files} files`,
    syncFailed: 'File sync failed',
    syncUnrecognized: ({ count }: { count: number }) =>
      count === 1
        ? '1 file has no readable volume or chapter number'
        : `${count} files have no readable volume or chapter number`
  },

  files: {
    title: 'Files',
    readFile: 'Read this file',
    missingFile: 'No file',
    noFiles: 'No files yet',
    fileCount: ({ count }: { count: number }) => (count === 1 ? '1 file' : `${count} files`),
    primary: 'Primary',
    container: 'Container',
    pageCount: 'Pages',
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
    openComicDir: 'Open comic folder',
    comicDirNotSet: 'The comic folder is not set',
    readStatus: 'Read status'
  },

  filesConfig: {
    title: 'Files configuration',
    comicDirLabel: 'Comic folder',
    comicDirPlaceholder: 'Not set',
    selectDir: 'Select folder',
    comicDirHint:
      'File sync scans this folder to match unit files; leave it empty for fully manual file management. Saving a change re-syncs files.'
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
    emptyHint: 'Reading time is recorded here automatically once you open a unit',
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
