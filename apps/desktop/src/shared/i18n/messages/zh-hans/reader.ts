import type { Messages } from '@shared/i18n'

/** Reader window: the comic pager and the novel text engine share one shell. */
export const reader = {
  loading: '正在打开…',
  loadFailed: '无法打开阅读器',
  close: '关闭',

  units: {
    comicLabel: '单元',
    novelLabel: '卷',
    previous: '上一单元',
    next: '下一单元',
    endOfUnit: '本单元结束',
    lastUnit: '已是最后一个单元',
    readBadge: '已读',
    noFile: '该单元没有可读取的文件'
  },

  comic: {
    pageFlow: '翻页方向',
    pageFlowRtl: '从右到左',
    pageFlowLtr: '从左到右',
    pageFlowVertical: '垂直滚动',
    spread: '双页跨页',
    coverAlone: '封面单独成页',
    fitWidth: '适应宽度',
    fitHeight: '适应高度',
    zoomIn: '放大',
    zoomOut: '缩小',
    pageLoadFailed: '无法加载该页',
    emptyPages: '该文件没有可读取的页面',
    openFailed: '无法打开该单元',
    nextUnitHint: '已到结尾——继续阅读下一单元'
  },

  novel: {
    progress: ({ percent }: { percent: number }) => `${percent}%`,
    toc: '目录',
    emptyToc: '没有目录',
    fontSizeDecrease: '缩小文字',
    fontSizeIncrease: '放大文字',
    openFailed: '无法打开该卷'
  },

  shortcuts: {
    open: '键盘快捷键',
    title: '键盘快捷键',
    turnPage: '翻页',
    switchUnit: '上一个或下一个单元',
    jumpEdges: '首页或末页',
    zoom: '放大、缩小或还原',
    closeReader: '关闭阅读器'
  }
} satisfies Messages['reader']
