import type { Messages } from '../schema'

/** Ingest pipeline: task-run titles, phase labels, and results owned by the main process. */

type IngestEntity = 'game' | 'character' | 'person' | 'company'

const NOUNS: Record<IngestEntity, string> = {
  game: 'ゲーム',
  character: 'キャラクター',
  person: '人物',
  company: '会社'
}

export const ingest = {
  add: {
    title: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}を追加`,
    checkingExisting: ({ entity }: { entity: IngestEntity }) =>
      `既存の${NOUNS[entity]}を確認しています`,
    scrapingMetadata: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}のメタデータを取得しています`,
    buildingMetadata: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}のメタデータを整理しています`,
    writing: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}を書き込んでいます`,
    addedTitle: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}を追加しました`,
    existsTitle: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}は既に存在します`,
    addedSummary: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}をライブラリに追加しました。`,
    existsSummary: ({ entity }: { entity: IngestEntity }) =>
      `既存の${NOUNS[entity]}と一致しました。`,
    cancelledSummary: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}の追加はキャンセルされました。`
  },

  update: {
    title: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}のメタデータを更新`,
    preparing: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}のメタデータ更新を準備しています`,
    scrapingMetadata: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}のメタデータを取得しています`,
    planning: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}の更新プランを作成しています`,
    writing: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}のメタデータを書き込んでいます`,
    completedTitle: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}のメタデータを更新しました`,
    completedSummary: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}のメタデータをライブラリに書き込みました。`,
    cancelledSummary: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}のメタデータ更新はキャンセルされました。`
  },

  batch: {
    title: ({ entity }: { entity: IngestEntity }) => `${NOUNS[entity]}のメタデータを一括更新`,
    subjectCount: ({ entity, count }: { entity: IngestEntity; count: number }) =>
      `${count} 件の${NOUNS[entity]}`,
    preparingList: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}リストを準備しています`,
    noSearchResults: '検索結果がありません。',
    completedTitle: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}のメタデータ一括更新が完了しました`,
    completedWithFailuresTitle: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}のメタデータ一括更新が完了しました（失敗あり）`,
    resultSummary: ({
      succeeded,
      failed,
      skipped
    }: {
      succeeded: number
      failed: number
      skipped: number
    }) => `成功 ${succeeded}、失敗 ${failed}、スキップ ${skipped}。`,
    cancelledSummary: ({
      succeeded,
      failed,
      skipped
    }: {
      succeeded: number
      failed: number
      skipped: number
    }) => `キャンセルしました。成功 ${succeeded}、失敗 ${failed}、スキップ ${skipped}。`,
    matchingRemote: 'リモートエントリを照合しています',
    updatingLocal: 'ローカルメタデータを更新しています',
    fallbackItemLabel: '項目',
    itemMessage: ({ name, detail }: { name: string; detail: string }) => `${name}：${detail}`
  },

  persist: {
    savingMedia: ({ entity }: { entity: IngestEntity }) =>
      `${NOUNS[entity]}のメディアを保存しています`
  }
} satisfies Messages['ingest']
