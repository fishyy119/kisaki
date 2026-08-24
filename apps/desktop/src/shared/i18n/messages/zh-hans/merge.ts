import type { Messages } from '../schema'

export const merge = {
  title: '合并重复实体',
  keep: '保留',
  selectDuplicate: ({ label }: { label: string }) => `选择重复${label}…`,
  confirmTitle: ({ source, target }: { source: string; target: string }) =>
    `将「${source}」合并到「${target}」`,
  confirmDescription: ({ source }: { source: string }) =>
    `「${source}」会被删除；外部 ID、关系、标签、合集、活动记录和附件会迁移到保留实体，目标已有信息保持不变`,
  action: '合并',
  merged: ({ name }: { name: string }) => `已合并到「${name}」`,
  fallbackTargetName: '目标实体',
  failed: '合并失败',
  staticCollection: '静态合集',
  dynamicCollection: '动态合集'
} satisfies Messages['merge']
