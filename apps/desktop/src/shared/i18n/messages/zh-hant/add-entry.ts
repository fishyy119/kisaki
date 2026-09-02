import type { Messages } from '../schema'

/** Add entry: the quick-add trigger menu and the add-entry dialogs. */
export const addEntry = {
  trigger: '新增',
  addScanner: '新增掃描器',

  addFailed: ({ label }: { label: string }) => `新增${label}失敗`,
  addCancelled: ({ label }: { label: string }) => `已取消新增${label}`,
  missingEntityId: ({ label }: { label: string }) => `任務結果缺少${label} ID`,

  autofillHint: '點選搜尋結果自動填入 ID',
  adding: '正在新增…',
  submit: '識別並新增',

  existingReasonExternalId: '外部 ID',
  existingReasonPath: '路徑',
  existingReasonUnknown: '未知原因',
  postProcessWarnings: ({ count }: { count: number }) => `${count} 個資源後處理步驟失敗，請查看日誌`
} satisfies Messages['addEntry']
