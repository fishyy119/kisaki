/**
 * Game-specific surfaces: play button, play status, launch settings,
 * save backups, notes, play time records, and the activity tab.
 */
export const game = {
  play: 'Play',
  stop: 'Stop',
  launching: 'Starting',
  stopping: 'Stopping',

  statusDialog: {
    title: 'Edit play status',
    label: 'Play status',
    selectStatus: 'Select status'
  },

  lastActiveDialog: {
    title: 'Edit last played time',
    label: 'Last played time',
    emptyHint: 'Leave empty if the game has never been played.'
  },

  duration: {
    title: 'Edit play time',
    totalTime: 'Total play time',
    sessionsDuration: ({ value }: { value: string }) => `Sessions: ${value}`,
    untrackedDuration: ({ value }: { value: string }) => `Untracked: ${value}`,
    untrackedLabel: 'Untracked play time',
    hoursUnit: 'Hours',
    minutesUnit: 'Minutes',
    untrackedHint: 'Play time not recorded by game sessions (for example imported history).',
    sessionsHeader: ({ count }: { count: number }) => `Sessions (${count})`,
    emptySessions: 'No sessions yet. Use the button below to add one.',
    addRecord: 'Add record',
    editRecord: 'Edit record',
    startTime: 'Start time',
    endTime: 'End time',
    startEndRequired: 'Fill in both the start and end times.',
    endAfterStart: 'The end time must be after the start time.',
    overlap: 'The time range overlaps an existing record. Adjust the times.',
    recordAdded: 'Record added.',
    recordUpdated: 'Record updated.',
    recordDeleted: 'Record deleted.',
    deleteRecordTitle: 'Delete record?',
    deleteRecordDescription:
      'This removes the session record permanently. This action cannot be undone.'
  },

  launchConfig: {
    title: 'Launch settings',
    tabLaunch: 'Launch',
    tabMonitor: 'Monitor',
    tabSave: 'Saves',
    saved: 'Launch settings saved.',
    gameDirLabel: 'Game folder',
    gameDirHint: 'Used for auto-derivation and as the working directory in command mode.',
    launchModeLabel: 'Launch mode',
    modeFile: 'File',
    modeFileHint: 'Run the executable directly',
    modeUrl: 'URL',
    modeUrlHint: 'Launch through a URL protocol (for example steam://)',
    modeExec: 'Command',
    modeExecHint: 'Run a command line',
    launchFileLabel: 'Launch file',
    launchUrlLabel: 'Launch URL',
    launchCommandLabel: 'Launch command',
    urlPlaceholder: 'For example: steam://rungameid/123',
    monitorModeLabel: 'Monitor mode',
    monitorFolder: 'Folder',
    monitorFolderHint: 'Monitor every process inside the folder',
    monitorFile: 'File',
    monitorFileHint: 'Monitor the specified executable',
    monitorProcess: 'Process name',
    monitorProcessHint: 'Monitor processes with the specified name',
    processNameLabel: 'Process name',
    monitorPathLabel: 'Monitored path',
    autoDeriveTitle: 'Derived automatically when empty',
    autoDeriveFolderHint: 'Prefers the game folder, otherwise the launch file folder',
    autoDeriveFileHint: 'Uses the launch file path',
    autoDeriveProcessHint: 'Extracted from the launch file name, for example game.exe',
    autoDerivePlaceholder: 'Leave empty to derive automatically',
    willUse: ({ path }: { path: string }) => `Will use: ${path}`,
    savePathLabel: 'Save folder',
    savePathHint: 'Save folder used for automatic backups.',
    maxBackupsLabel: 'Max backups',
    maxBackupsHint: 'The oldest backup is removed automatically past this limit.'
  },

  saves: {
    backupCreated: 'Backup created.',
    createBackupFailed: 'Could not create the backup',
    restored: 'Save restored.',
    restoreFailed: 'Could not restore the save',
    backupDeleted: 'Backup deleted.',
    deleteBackupFailed: 'Could not delete the backup.',
    backupInfoUpdated: 'Backup info updated.',
    noSavePathTitle: 'Save folder is not set',
    noSavePathHint: 'Configure the save folder in the game settings to use backups.',
    emptyBackupsTitle: 'No save backups yet',
    emptyBackupsHint: 'Create a backup to protect your progress.',
    createBackup: 'Create backup',
    backupCount: ({ current, max }: { current: number; max: number }) =>
      `${current} / ${max} backups`,
    saveDir: 'Save folder',
    backupDir: 'Backup folder',
    restoreTitle: 'Restore save?',
    restoreDescription:
      'Restoring this backup overwrites the current save. This action cannot be undone.',
    confirmRestore: 'Restore',
    restoreTooltip: 'Restore',
    backupEntityLabel: 'Backup',
    editBackupTitle: 'Edit backup',
    notePlaceholder: 'For example: chapter 3 clear save',
    lockLabel: 'Lock backup',
    lockHint: 'Locked backups are never cleaned up automatically.'
  },

  notes: {
    title: 'Notes',
    newNote: 'New note',
    editNote: 'Edit note',
    noteDeleted: 'Note deleted.',
    reorderFailed: 'Reorder failed.',
    emptyTitle: 'No notes yet',
    emptyHint: 'Capture thoughts and screenshots as you play.',
    notFound: 'Note not found.',
    titleLabel: 'Title',
    titlePlaceholder: 'Enter a title',
    contentLabel: 'Content',
    contentPlaceholder: 'Supports Markdown…',
    entityLabel: 'Note'
  },

  activity: {
    statsOverview: 'Overview',
    heatmap: 'Activity heatmap',
    trend: 'Play trend',
    distribution: 'Time distribution',
    recentSessions: 'Recent sessions',
    emptyTitle: 'No play activity yet',
    emptyHint: 'Play time is recorded here automatically once you launch the game.',
    totalDuration: 'Play time',
    sessionCount: 'Play count',
    sessionCountValue: ({ count }: { count: number }) =>
      count === 1 ? '1 session' : `${count} sessions`,
    avgDuration: 'Average session',
    longestSession: 'Longest session',
    currentStreak: 'Current streak',
    longestStreak: 'Longest streak',
    streakValue: ({ days }: { days: number }) => (days === 1 ? '1 day' : `${days} days`),
    firstSession: 'First played',
    lastSession: 'Last played',
    dayOfMonthLabel: ({ day }: { day: number }) => `${day}`
  }
}
