import type { Messages } from '../schema'

/** Add entry: the quick-add trigger menu and the add-entry dialogs. */
export const addEntry = {
  trigger: '追加',
  addScanner: 'スキャナーを追加',

  addFailed: ({ label }: { label: string }) => `${label}を追加できませんでした`,
  addCancelled: ({ label }: { label: string }) => `${label}の追加をキャンセルしました`,
  missingEntityId: ({ label }: { label: string }) => `タスク結果に${label} ID がありません`,

  autofillHint: '検索結果をクリックすると ID が自動入力されます',
  adding: '追加中…',
  submit: '照合して追加',

  existingReasonExternalId: '外部 ID',
  existingReasonPath: 'パス',
  existingReasonUnknown: '不明な理由',
  postProcessWarnings: ({ count }: { count: number }) =>
    `${count} 件のアセット後処理が失敗しました。ログを確認してください。`
} satisfies Messages['addEntry']
