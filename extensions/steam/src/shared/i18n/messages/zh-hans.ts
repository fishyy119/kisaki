import type { SteamMessages } from '../index'

export const zhHans: SteamMessages = {
  errors: {
    keyRequired: '请先保存 Steam Web API 密钥',
    steamIdInvalid: '请输入有效的 SteamID64(以 7656 开头的 17 位数字)',
    keyRejected: 'Steam 拒绝了该 Web API 密钥',
    profileNotVisible: 'Steam 未返回任何游戏。请检查 SteamID，并确认资料中的游戏详情已公开。',
    notFound: '该 Steam 应用不存在或未在商店公开',
    rateLimited: '对 Steam 的请求过于频繁，请稍后重试。',
    rejected: 'Steam API 拒绝了请求',
    unavailable: 'Steam API 暂时不可用',
    networkFailed: '对 Steam 的网络请求失败',
    operationCancelled: '操作已取消',
    idInvalid: ({ value }) => `“${value}”不是有效的 Steam 应用 ID`,
    keyEmpty: '请输入 Web API 密钥',
    operationRunning: '已有 Steam 导入正在运行，请等待其完成。'
  },

  import: {
    taskTitle: '导入已拥有的 Steam 游戏',
    phaseRead: '正在读取拥有的游戏',
    phaseApply: '正在创建条目',
    itemFailed: ({ id }) => `${id} 导入失败`,
    summary: ({ created, existing, failed }) =>
      `新建 ${created} 项、已存在 ${existing} 项、失败 ${failed} 项`
  },

  settings: {
    webviewTitle: 'Steam',
    commandLabel: '设置',
    commandDescription: '连接 Steam 账号、导入已拥有游戏并配置刮削'
  },

  ui: {
    loading: '加载中…',
    unavailable: '无法加载 Steam 设置',
    saved: '设置已保存',
    savePreferences: '保存',
    discardChanges: '放弃',
    unsavedChanges: '有未保存的更改',
    actionFailed: '操作失败',
    cancel: '取消',
    confirm: '确认',

    account: {
      title: '账号',
      description:
        '导入已拥有游戏需要个人 Web API 密钥与账号的 SteamID64，且资料中的游戏详情需设为公开。',
      statusLabel: '状态',
      configuredLabel: '已保存密钥',
      missingLabel: '未保存密钥',
      keyLabel: 'Web API 密钥',
      keyPlaceholder: '粘贴 Web API 密钥',
      steamIdLabel: 'SteamID64',
      steamIdDescription: '17 位数字，可在资料页 URL 或第三方工具中查看',
      saveKey: '保存密钥',
      clearKey: '移除密钥',
      verify: '验证',
      verifiedGames: ({ count }) => `可见 ${count} 款游戏`,
      openKeyPage: '获取 Web API 密钥'
    },

    integration: {
      title: '已拥有游戏导入',
      description: '读取拥有的游戏库，并经所选配置创建缺失条目。已带有 Steam ID 的条目保持不变。',
      profileLabel: '游戏配置',
      profilePlaceholder: '选择配置',
      startImport: '导入已拥有游戏',
      taskProgress: ({ current, total }) => `${current} / ${total}`,
      taskRunning: '进行中',
      taskCompleted: '已完成',
      taskFailed: '失败',
      taskCancelled: '已取消',
      cancelTask: '取消'
    },

    preferences: {
      title: '偏好',
      description: '作用于所有 Steam 请求',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '限流或服务器错误后的额外尝试次数',
      retryUnit: '次',
      reset: '恢复默认设置',
      resetDescription: '偏好将恢复为默认值，已保存的密钥保留。',
      resetSucceeded: '已恢复默认设置'
    }
  }
}
