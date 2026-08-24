import type { Messages } from '../schema'

export const ui = {
  stateView: {
    errorTitle: '加载失败'
  },
  combobox: {
    noMatches: '未找到匹配项',
    create: ({ name }: { name: string }) => `创建“${name}”`
  },
  imagePicker: {
    picked: '已选择：',
    pick: '选择图片',
    clear: '清除'
  },
  imageCropper: {
    title: '裁剪图片',
    recommendedRatio: ({ ratio }: { ratio: string }) => `推荐比例：${ratio}`,
    fixedRatio: ({ ratio }: { ratio: string }) => `固定比例：${ratio}`,
    lockRatio: '锁定比例',
    freeCrop: '自由裁剪',
    cropArea: ({ width, height }: { width: number; height: number }) =>
      `裁剪区域：${width} × ${height} px`,
    confirm: '确认裁剪'
  },
  markdown: {
    editorTitle: '编辑 Markdown',
    previewTitle: '预览',
    toolbar: {
      bold: '加粗',
      italic: '斜体',
      strikethrough: '删除线',
      inlineCode: '行内代码',
      codeBlock: '代码块',
      link: '链接',
      imageSyntax: '图片语法',
      heading1: '一级标题',
      heading2: '二级标题',
      quote: '引用',
      bulletedList: '无序列表',
      numberedList: '有序列表',
      taskList: '任务列表',
      table: '表格',
      footnote: '脚注',
      attachImage: '附加图片',
      preview: '预览',
      fullscreen: '全屏',
      exitFullscreen: '退出全屏'
    }
  },
  partialDate: {
    yearPlaceholder: '年',
    monthPlaceholder: '月',
    dayPlaceholder: '日',
    invalidInteger: '日期只能填写整数',
    yearDayWithoutMonth: '填写了年份和日期时，必须同时填写月份'
  },
  rankingList: {
    expandTitle: '排行',
    viewAll: ({ count }: { count: number }) => `查看全部 ${count} 项`
  },
  charts: {
    day: '日',
    week: '周',
    month: '月',
    hourly: '小时',
    weekday: '星期',
    dayOfMonth: '日期',
    duration: '时长',
    noActivity: '无活动',
    legendLess: '少',
    legendMore: '多',
    peak: ({ label, value }: { label: string; value: string }) => `峰值：${label}，${value}`,
    peakNone: '峰值：无活动',
    mostActive: ({ label, value }: { label: string; value: string }) =>
      `最活跃：${label}，${value}`,
    mostActiveNone: '最活跃：无活动'
  },
  deleteConfirm: {
    deleteTitle: ({ label }: { label: string }) => `确认删除${label}？`,
    removeTitle: ({ label }: { label: string }) => `确认移除${label}？`,
    removeNamedDescription: ({ name }: { name: string }) => `确定要移除「${name}」吗？`,
    removeDescription: ({ label }: { label: string }) => `确定要移除此${label}吗？`,
    deleteNamedDescription: ({ name, label }: { name: string; label: string }) =>
      `确定要删除「${name}」吗？此操作无法撤销，${label}数据将被永久删除。`,
    deleteDescription: ({ label }: { label: string }) => `此操作无法撤销，${label}数据将被永久删除`,
    removing: '移除中…',
    deleting: '删除中…'
  },
  spoiler: {
    title: '显示剧透？',
    description: '开启后将立即显示被标记为剧透的内容'
  }
} satisfies Messages['ui']
