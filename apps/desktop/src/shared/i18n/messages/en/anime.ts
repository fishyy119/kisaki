/**
 * Anime-specific surfaces: watch button, episode list, extras, and the
 * playback controls shown while an episode is playing.
 */
export const anime = {
  watch: 'Watch',
  watchNext: 'Watch next',
  stop: 'Stop',
  starting: 'Starting',
  stopping: 'Stopping',
  playing: 'Playing',

  episodes: {
    title: 'Episodes',
    emptyTitle: 'No episodes yet',
    emptyHint: 'Scan the anime folder or scrape metadata to build the episode list.',
    unnamed: ({ number }: { number: string }) => `Episode ${number}`,
    watched: 'Watched',
    unwatched: 'Unwatched',
    missingFile: 'No file',
    fileCount: ({ count }: { count: number }) => (count === 1 ? '1 file' : `${count} files`),
    resumeAt: ({ position }: { position: string }) => `Resume at ${position}`,
    markWatched: 'Mark as watched',
    markUnwatched: 'Mark as unwatched',
    watchedUpdated: 'Watch state updated.',
    progress: ({ watched, total }: { watched: number; total: number }) =>
      `${watched} / ${total} watched`
  },

  extras: {
    title: 'Extras',
    emptyTitle: 'No extras yet',
    emptyHint: 'Trailers and creditless openings found in the folder show up here.'
  },

  files: {
    title: 'Files',
    primary: 'Primary',
    resolution: 'Resolution',
    codec: 'Codec',
    audioTracks: 'Audio tracks',
    subtitleTracks: 'Subtitle tracks',
    openFolder: 'Open containing folder',
    openFolderFailed: 'Could not open the containing folder.'
  },

  player: {
    pause: 'Pause',
    resume: 'Resume',
    paused: 'Paused',
    pauseFailed: 'Could not pause playback.',
    resumeFailed: 'Could not resume playback.'
  },

  detail: {
    openAnimeDir: 'Open anime folder',
    animeDirNotSet: 'The anime folder is not set.',
    watchStatus: 'Watch status'
  },

  activity: {
    emptyTitle: 'No watch activity yet',
    emptyHint: 'Watch time is recorded here automatically once you start an episode.',
    watchDuration: 'Watch time',
    sessionCount: 'Sessions',
    lastWatched: 'Last watched'
  }
}
