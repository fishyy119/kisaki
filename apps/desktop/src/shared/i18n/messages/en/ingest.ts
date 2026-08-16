/** Ingest pipeline: task-run titles, phase labels, and results owned by the main process. */

type IngestEntity = 'game' | 'anime' | 'tv' | 'movie' | 'character' | 'person' | 'company'

const NOUNS: Record<IngestEntity, string> = {
  game: 'game',
  anime: 'anime',
  tv: 'series',
  movie: 'movie',
  character: 'character',
  person: 'person',
  company: 'company'
}

const PLURALS: Record<IngestEntity, string> = {
  game: 'games',
  anime: 'anime',
  tv: 'series',
  movie: 'movies',
  character: 'characters',
  person: 'people',
  company: 'companies'
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export const ingest = {
  add: {
    title: ({ entity }: { entity: IngestEntity }) => `Add ${NOUNS[entity]}`,
    checkingExisting: ({ entity }: { entity: IngestEntity }) =>
      `Checking existing ${PLURALS[entity]}`,
    scrapingMetadata: ({ entity }: { entity: IngestEntity }) =>
      `Fetching ${NOUNS[entity]} metadata`,
    buildingMetadata: ({ entity }: { entity: IngestEntity }) =>
      `Organizing ${NOUNS[entity]} metadata`,
    writing: ({ entity }: { entity: IngestEntity }) => `Writing the ${NOUNS[entity]}`,
    addedTitle: ({ entity }: { entity: IngestEntity }) => `${capitalize(NOUNS[entity])} added`,
    existsTitle: ({ entity }: { entity: IngestEntity }) =>
      `${capitalize(NOUNS[entity])} already exists`,
    addedSummary: ({ entity }: { entity: IngestEntity }) =>
      `The ${NOUNS[entity]} was added to the library.`,
    existsSummary: ({ entity }: { entity: IngestEntity }) =>
      `Matched an existing ${NOUNS[entity]}.`,
    cancelledSummary: ({ entity }: { entity: IngestEntity }) =>
      `Adding the ${NOUNS[entity]} was cancelled.`
  },

  update: {
    title: ({ entity }: { entity: IngestEntity }) => `Update ${NOUNS[entity]} metadata`,
    preparing: ({ entity }: { entity: IngestEntity }) =>
      `Preparing the ${NOUNS[entity]} metadata update`,
    scrapingMetadata: ({ entity }: { entity: IngestEntity }) =>
      `Fetching ${NOUNS[entity]} metadata`,
    planning: ({ entity }: { entity: IngestEntity }) => `Building the ${NOUNS[entity]} update plan`,
    writing: ({ entity }: { entity: IngestEntity }) => `Writing ${NOUNS[entity]} metadata`,
    completedTitle: ({ entity }: { entity: IngestEntity }) =>
      `${capitalize(NOUNS[entity])} metadata updated`,
    completedSummary: ({ entity }: { entity: IngestEntity }) =>
      `The ${NOUNS[entity]} metadata was written to the library.`,
    cancelledSummary: ({ entity }: { entity: IngestEntity }) =>
      `Updating ${NOUNS[entity]} metadata was cancelled.`
  },

  batch: {
    title: ({ entity }: { entity: IngestEntity }) => `Batch update ${NOUNS[entity]} metadata`,
    subjectCount: ({ entity, count }: { entity: IngestEntity; count: number }) =>
      `${count} ${count === 1 ? NOUNS[entity] : PLURALS[entity]}`,
    preparingList: ({ entity }: { entity: IngestEntity }) => `Preparing the ${NOUNS[entity]} list`,
    noSearchResults: 'No search results.',
    completedTitle: ({ entity }: { entity: IngestEntity }) =>
      `Batch ${NOUNS[entity]} metadata update completed`,
    completedWithFailuresTitle: ({ entity }: { entity: IngestEntity }) =>
      `Batch ${NOUNS[entity]} metadata update completed with failures`,
    resultSummary: ({
      succeeded,
      failed,
      skipped
    }: {
      succeeded: number
      failed: number
      skipped: number
    }) => `Succeeded ${succeeded}, failed ${failed}, skipped ${skipped}.`,
    cancelledSummary: ({
      succeeded,
      failed,
      skipped
    }: {
      succeeded: number
      failed: number
      skipped: number
    }) => `Cancelled. Succeeded ${succeeded}, failed ${failed}, skipped ${skipped}.`,
    matchingRemote: 'Matching remote entries',
    updatingLocal: 'Updating local metadata',
    fallbackItemLabel: 'Item',
    itemMessage: ({ name, detail }: { name: string; detail: string }) => `${name}: ${detail}`
  },

  persist: {
    savingMedia: ({ entity }: { entity: IngestEntity }) => `Saving ${NOUNS[entity]} media`
  }
}
