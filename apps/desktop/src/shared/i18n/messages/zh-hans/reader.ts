import type { Messages } from '@shared/i18n'

/** Reader window: the comic pager and the novel text engine share one shell. */
export const reader = {
  loading: '正在打开…',
  loadFailed: '无法打开阅读器',
  close: '关闭',

  chrome: {
    navigation: '导航',
    enterFullScreen: '全屏'
  },

  panel: {
    outline: '目录',
    pages: '页面',
    marks: '标记',
    search: '搜索',
    outlineHeading: '本单元内',
    noPages: '该单元没有可预览的页面'
  },

  search: {
    open: '书内搜索',
    placeholder: '书内搜索',
    noResults: '没有匹配结果',
    unnamedSection: '未命名章节',
    tooMany: ({ count }: { count: number }) => `仅显示前 ${count} 条匹配——请缩小搜索范围`
  },

  footnote: {
    title: '注释'
  },

  marks: {
    addBookmark: '书签',
    highlight: '高亮',
    copy: '复制',
    dismiss: '关闭',
    edit: '编辑标记',
    color: '高亮颜色',
    notePlaceholder: '备注',
    saveNote: '保存',
    remove: '删除',
    empty: '还没有标记',
    bookmarksHeading: '书签',
    highlightsHeading: '高亮',
    page: ({ page }: { page: number }) => `第 ${page} 页`,
    bookmarkAdded: '已添加书签',
    bookmarkRemoved: '已移除书签',
    failed: '无法保存该标记'
  },

  /** Bare setting readouts, shared by every reader surface that shows one. */
  values: {
    percent: ({ value }: { value: number }) => `${value}%`,
    pixels: ({ value }: { value: number }) => `${value} px`,
    ratio: ({ value }: { value: number }) => value.toFixed(1),
    em: ({ value }: { value: number }) => `${value} em`
  },

  progress: {
    pageOf: ({ page, total }: { page: number; total: number | null }) =>
      total === null ? `${page} / ?` : `${page} / ${total}`,
    jumpToPage: '跳转到页',
    jump: '跳转',
    elapsed: ({ minutes }: { minutes: number }) => `${minutes} 分钟`
  },

  typography: {
    open: '排版',
    font: '字体',
    fontBook: '书籍自带',
    fontSerif: '衬线',
    fontSans: '无衬线',
    fontCustom: '自定义',
    customFont: '字体名称',
    fontPick: '选择字体',
    fontSearch: '搜索字体',
    fontSize: '文字大小',
    lineHeight: '行高',
    paragraphSpacing: '段间距',
    textWidth: '栏宽',
    twoColumns: '双栏',
    justify: '两端对齐',
    writingMode: '排版方向',
    writingModeBook: '跟随书籍',
    writingModeVertical: '竖排',
    writingModeHorizontal: '横排',
    tint: '页面底色',
    tintTheme: '跟随主题',
    tintPaper: '纸感',
    tintSepia: '护眼',
    reset: '重置排版'
  },

  units: {
    comicLabel: '单元',
    novelLabel: '卷',
    previous: '上一单元',
    next: '下一单元',
    endOfUnit: '本单元结束',
    lastUnit: '已是最后一个单元',
    readBadge: '已读',
    noFile: '该单元没有可读取的文件',
    openFailed: '无法打开该单元',
    nextUnitHint: '已到结尾——继续阅读下一单元'
  },

  image: {
    settingsOpen: '页面设置',
    pageFlow: '翻页方向',
    pageFlowRtl: '从右到左',
    pageFlowLtr: '从左到右',
    pageFlowVertical: '垂直滚动',
    pageLayout: '页面布局',
    layoutSingle: '单页',
    layoutDouble: '双页',
    coverAlone: '封面单独成页',
    fit: '适应方式',
    fitPage: '适应页面',
    fitWidth: '适应宽度',
    fitHeight: '适应高度',
    zoomIn: '放大',
    zoomOut: '缩小',
    brightness: '亮度',
    contrast: '对比度',
    autoCrop: '裁去页面白边',
    reset: '重置页面设置',
    pageLoadFailed: '无法加载该页',
    emptyPages: '该文件没有可读取的页面'
  },

  shortcuts: {
    open: '键盘快捷键',
    title: '键盘快捷键',
    turnPage: '翻页',
    switchUnit: '上一个或下一个单元',
    jumpEdges: '首页或末页',
    jumpToPage: '跳转到页',
    zoom: '放大、缩小或还原',
    ctrlWheel: 'Ctrl+滚轮',
    search: '书内搜索',
    bookmark: '为当前位置加书签',
    navigation: '开关导航',
    fullScreen: '开关全屏',
    closeReader: '关闭阅读器'
  }
} satisfies Messages['reader']
