import type { Messages } from '../schema'

/** Adder: quick-add trigger menu and entity adder dialogs. */
export const adder = {
  trigger: '添加',
  addScanner: '添加扫描器',

  addFailed: ({ label }: { label: string }) => `添加${label}失败`,
  addCancelled: ({ label }: { label: string }) => `已取消添加${label}`,
  missingEntityId: ({ label }: { label: string }) => `任务结果缺少${label} ID`,

  autofillHint: '点击搜索结果自动填充 ID',
  adding: '正在添加…',
  submit: '识别并添加',

  existingReasonExternalId: '外部 ID',
  existingReasonPath: '路径',
  existingReasonUnknown: '未知原因',
  postProcessWarnings: ({ count }: { count: number }) => `${count} 个资源后处理步骤失败，请查看日志`
} satisfies Messages['adder']
