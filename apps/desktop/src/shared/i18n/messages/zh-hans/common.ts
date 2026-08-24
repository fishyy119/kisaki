import type { Messages } from '../schema'

export const common = {
  // Actions
  add: '添加',
  apply: '应用',
  back: '返回',
  browse: '浏览…',
  cancel: '取消',
  clear: '清除',
  close: '关闭',
  confirm: '确认',
  copy: '复制',
  create: '创建',
  delete: '删除',
  edit: '编辑',
  export: '导出',
  import: '导入',
  moveDown: '下移',
  moveUp: '上移',
  next: '下一步',
  open: '打开',
  preview: '预览',
  previous: '上一步',
  refresh: '刷新',
  remove: '移除',
  rename: '重命名',
  reset: '重置',
  retry: '重试',
  save: '保存',
  search: '搜索',
  select: '选择',
  selectAll: '全选',
  view: '查看',

  // States
  loading: '正在加载…',
  saving: '正在保存…',
  processing: '正在处理…',
  enabled: '已启用',
  disabled: '已禁用',
  on: '开',
  off: '关',
  yes: '是',
  no: '否',
  all: '全部',
  none: '无',
  unknown: '未知',
  never: '从未',
  notSet: '未设置',
  notSpecified: '不指定',
  optional: '可选',
  required: '必填',

  // Feedback
  saved: '已保存',
  deleted: '已删除',
  copied: '已复制',
  saveFailed: '保存失败',
  deleteFailed: '删除失败',
  copyFailed: '复制失败',
  loadFailed: '加载失败',
  operationFailed: '操作失败',

  // Placeholders and empty values
  emptyValue: '—',
  searchPlaceholder: '搜索',
  noResults: '没有匹配的结果',
  noData: '暂无数据',

  // Counts
  itemCount: ({ count }) => `${count} 项`,
  selectedCount: ({ count }) => `已选择 ${count} 项`
} satisfies Messages['common']
