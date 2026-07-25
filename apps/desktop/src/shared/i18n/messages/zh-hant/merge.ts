import type { Messages } from '../schema'

export const merge = {
  title: '合併重複實體',
  keep: '保留',
  selectDuplicate: ({ label }: { label: string }) => `選擇重複${label}…`,
  confirmTitle: ({ source, target }: { source: string; target: string }) =>
    `將「${source}」合併到「${target}」`,
  confirmDescription: ({ source }: { source: string }) =>
    `「${source}」會被刪除；外部 ID、關係、標籤、合集、活動記錄和附件會遷移到保留實體，目標既有資訊保持不變。`,
  action: '合併',
  merged: ({ name }: { name: string }) => `已合併到「${name}」`,
  fallbackTargetName: '目標實體',
  failed: '合併失敗',
  staticCollection: '靜態合集',
  dynamicCollection: '動態合集'
} satisfies Messages['merge']
