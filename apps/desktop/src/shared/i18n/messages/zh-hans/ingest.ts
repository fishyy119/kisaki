import type { Messages } from '../schema'

/** Ingest pipeline: task-run titles, phase labels, and results owned by the main process. */

type IngestEntity = 'game' | 'anime' | 'tv' | 'movie' | 'character' | 'person' | 'company'

const NOUNS: Record<IngestEntity, string> = {
  game: '游戏',
  anime: '动漫',
  tv: '剧集',
  movie: '电影',
  character: '角色',
  person: '人物',
  company: '公司'
}

export const ingest = {
  add: {
    title: ({ entity }: { entity: IngestEntity }) => `添加${NOUNS[entity]}`,
    checkingExisting: ({ entity }: { entity: IngestEntity }) => `正在检查现有${NOUNS[entity]}`,
    scrapingMetadata: ({ entity }: { entity: IngestEntity }) => `正在抓取${NOUNS[entity]}元数据`,
    buildingMetadata: ({ entity }: { entity: IngestEntity }) => `正在整理${NOUNS[entity]}元数据`,
    writing: ({ entity }: { entity: IngestEntity }) => `正在写入${NOUNS[entity]}`,
    addedTitle: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}添加成功`,
    existsTitle: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}已存在`,
    addedSummary: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}已写入资料库。`,
    existsSummary: ({ entity }: { entity: IngestEntity }) => `已匹配现有${NOUNS[entity]}。`,
    cancelledSummary: ({ entity }: { entity: IngestEntity }) => `添加${NOUNS[entity]}已取消。`
  },

  update: {
    title: ({ entity }: { entity: IngestEntity }) => `更新${NOUNS[entity]}元数据`,
    preparing: ({ entity }: { entity: IngestEntity }) => `正在准备更新${NOUNS[entity]}元数据`,
    scrapingMetadata: ({ entity }: { entity: IngestEntity }) => `正在抓取${NOUNS[entity]}元数据`,
    planning: ({ entity }: { entity: IngestEntity }) => `正在生成${NOUNS[entity]}更新计划`,
    writing: ({ entity }: { entity: IngestEntity }) => `正在写入${NOUNS[entity]}元数据`,
    completedTitle: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}元数据更新完成`,
    completedSummary: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}元数据已写入资料库。`,
    cancelledSummary: ({ entity }: { entity: IngestEntity }) => `更新${NOUNS[entity]}元数据已取消。`
  },

  batch: {
    title: ({ entity }: { entity: IngestEntity }) => `批量更新${NOUNS[entity]}元数据`,
    subjectCount: ({ entity, count }: { entity: IngestEntity; count: number }) =>
      `${count} 个${NOUNS[entity]}`,
    preparingList: ({ entity }: { entity: IngestEntity }) => `正在准备${NOUNS[entity]}列表`,
    noSearchResults: '无搜索结果。',
    completedTitle: ({ entity }: { entity: IngestEntity }) => `批量更新${NOUNS[entity]}元数据完成`,
    completedWithFailuresTitle: ({ entity }: { entity: IngestEntity }) =>
      `批量更新${NOUNS[entity]}元数据完成（有失败）`,
    resultSummary: ({
      succeeded,
      failed,
      skipped
    }: {
      succeeded: number
      failed: number
      skipped: number
    }) => `成功 ${succeeded}，失败 ${failed}，跳过 ${skipped}。`,
    cancelledSummary: ({
      succeeded,
      failed,
      skipped
    }: {
      succeeded: number
      failed: number
      skipped: number
    }) => `已取消。成功 ${succeeded}，失败 ${failed}，跳过 ${skipped}。`,
    matchingRemote: '正在匹配远端条目',
    updatingLocal: '正在更新本地元数据',
    fallbackItemLabel: '项目',
    itemMessage: ({ name, detail }: { name: string; detail: string }) => `${name}：${detail}`
  },

  persist: {
    savingMedia: ({ entity }: { entity: IngestEntity }) => `正在保存${NOUNS[entity]}媒体资源`
  }
} satisfies Messages['ingest']
