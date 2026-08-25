import type { Messages } from '../schema'

/** Ingest pipeline: task-run titles, phase labels, and results owned by the main process. */

type IngestEntity = 'game' | 'anime' | 'comic' | 'novel' | 'character' | 'person' | 'company'

const NOUNS: Record<IngestEntity, string> = {
  game: '遊戲',
  anime: '動漫',
  comic: '漫畫',
  novel: '小說',
  character: '角色',
  person: '人物',
  company: '公司'
}

export const ingest = {
  add: {
    title: ({ entity }: { entity: IngestEntity }) => `新增${NOUNS[entity]}`,
    checkingExisting: ({ entity }: { entity: IngestEntity }) => `正在檢查現有${NOUNS[entity]}`,
    scrapingMetadata: ({ entity }: { entity: IngestEntity }) => `正在擷取${NOUNS[entity]}中繼資料`,
    buildingMetadata: ({ entity }: { entity: IngestEntity }) => `正在整理${NOUNS[entity]}中繼資料`,
    writing: ({ entity }: { entity: IngestEntity }) => `正在寫入${NOUNS[entity]}`,
    addedTitle: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}新增成功`,
    existsTitle: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}已存在`,
    addedSummary: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}已寫入資料庫`,
    existsSummary: ({ entity }: { entity: IngestEntity }) => `已比對到現有${NOUNS[entity]}`,
    cancelledSummary: ({ entity }: { entity: IngestEntity }) => `新增${NOUNS[entity]}已取消`
  },

  update: {
    title: ({ entity }: { entity: IngestEntity }) => `更新${NOUNS[entity]}中繼資料`,
    preparing: ({ entity }: { entity: IngestEntity }) => `正在準備更新${NOUNS[entity]}中繼資料`,
    scrapingMetadata: ({ entity }: { entity: IngestEntity }) => `正在擷取${NOUNS[entity]}中繼資料`,
    planning: ({ entity }: { entity: IngestEntity }) => `正在產生${NOUNS[entity]}更新計畫`,
    writing: ({ entity }: { entity: IngestEntity }) => `正在寫入${NOUNS[entity]}中繼資料`,
    completedTitle: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}中繼資料更新完成`,
    completedSummary: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}中繼資料已寫入資料庫`,
    cancelledSummary: ({ entity }: { entity: IngestEntity }) => `更新${NOUNS[entity]}中繼資料已取消`
  },

  batch: {
    title: ({ entity }: { entity: IngestEntity }) => `批次更新${NOUNS[entity]}中繼資料`,
    subjectCount: ({ entity, count }: { entity: IngestEntity; count: number }) =>
      `${count} 個${NOUNS[entity]}`,
    preparingList: ({ entity }: { entity: IngestEntity }) => `正在準備${NOUNS[entity]}清單`,
    noSearchResults: '沒有搜尋結果',
    completedTitle: ({ entity }: { entity: IngestEntity }) =>
      `批次更新${NOUNS[entity]}中繼資料完成`,
    completedWithFailuresTitle: ({ entity }: { entity: IngestEntity }) =>
      `批次更新${NOUNS[entity]}中繼資料完成（有失敗）`,
    resultSummary: ({
      succeeded,
      failed,
      skipped
    }: {
      succeeded: number
      failed: number
      skipped: number
    }) => `成功 ${succeeded}，失敗 ${failed}，略過 ${skipped}`,
    cancelledSummary: ({
      succeeded,
      failed,
      skipped
    }: {
      succeeded: number
      failed: number
      skipped: number
    }) => `已取消。成功 ${succeeded}，失敗 ${failed}，略過 ${skipped}。`,
    matchingRemote: '正在比對遠端條目',
    updatingLocal: '正在更新本機中繼資料',
    fallbackItemLabel: '項目',
    itemMessage: ({ name, detail }: { name: string; detail: string }) => `${name}：${detail}`
  },

  persist: {
    savingMedia: ({ entity }: { entity: IngestEntity }) => `正在儲存${NOUNS[entity]}媒體資源`
  }
} satisfies Messages['ingest']
