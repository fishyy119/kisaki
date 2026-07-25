import type { Messages } from '../schema'

export const merge = {
  title: '重複エンティティを統合',
  keep: '保持',
  selectDuplicate: ({ label }: { label: string }) => `重複する${label}を選択…`,
  confirmTitle: ({ source, target }: { source: string; target: string }) =>
    `「${source}」を「${target}」に統合`,
  confirmDescription: ({ source }: { source: string }) =>
    `「${source}」は削除されます。外部 ID、関係、タグ、コレクション、アクティビティ記録、添付ファイルは保持されるエンティティへ移行され、統合先の既存情報は変更されません。`,
  action: '統合',
  merged: ({ name }: { name: string }) => `「${name}」に統合しました`,
  fallbackTargetName: '統合先エンティティ',
  failed: '統合に失敗しました',
  staticCollection: '静的コレクション',
  dynamicCollection: '動的コレクション'
} satisfies Messages['merge']
