import type { Messages } from '../schema'

/**
 * Game launcher: launch/stop outcome notifications and the launcher file
 * picker. Confirmed launches and stops are reported by the play button state,
 * so only the unexpected outcomes have copy here.
 */
export const launcher = {
  launchCancelledTitle: '已取消启动',
  launchFailedTitle: '启动游戏失败',
  launchRequestedTitle: '启动请求已发送',
  stopFailedTitle: '停止游戏失败',
  stopRequestedTitle: '停止请求已发送',

  filePickerTitle: '选择启动文件',
  filePickerButton: '选择',

  monitorUnavailable: '无法开始进程检测，请检查监控配置。',
  processNotDetected: '尚未检测到游戏进程，请检查监控配置。',
  stopNotConfirmed: '尚未确认游戏进程已停止。',

  errors: {
    gameNotFound: '游戏不存在。',
    launcherPathNotSet: '启动路径未设置。',
    fileNotFound: '启动文件不存在。',
    executableNotFound: '启动程序不存在。',
    openFileFailed: '打开启动文件失败。',
    invalidUrl: '启动链接格式不正确。',
    unknownMode: '未知启动方式。',
    gameNotRunning: '游戏未运行。',
    stopProcessFailed: '停止游戏进程失败。'
  }
} satisfies Messages['launcher']
