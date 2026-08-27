import type { Messages } from '../schema'

/**
 * Media activity: launch/stop and watch outcome notifications plus the launch
 * file picker. Confirmed outcomes are reported by the action button state, so
 * only the unexpected ones have copy here.
 */
export const activity = {
  launchCancelledTitle: '已取消启动',
  launchFailedTitle: '启动游戏失败',
  launchRequestedTitle: '启动请求已发送',
  stopFailedTitle: '停止游戏失败',
  stopRequestedTitle: '停止请求已发送',
  watchFailedTitle: '开始播放失败',
  watchStopFailedTitle: '停止播放失败',
  readFailedTitle: '开始阅读失败',
  readStopFailedTitle: '停止阅读失败',

  filePickerTitle: '选择启动文件',
  filePickerButton: '选择',

  monitorUnavailable: '无法开始进程检测，请检查监控配置',
  processNotDetected: '尚未检测到游戏进程，请检查监控配置',
  stopNotConfirmed: '尚未确认游戏进程已停止',

  errors: {
    gameNotFound: '游戏不存在',
    launcherPathNotSet: '启动路径未设置',
    fileNotFound: '文件不存在',
    executableNotFound: '启动程序不存在',
    openFileFailed: '打开启动文件失败',
    invalidUrl: '启动链接格式不正确',
    gameNotRunning: '游戏未运行',
    stopProcessFailed: '停止游戏进程失败',
    alreadyWatching: '该条目已在播放中',
    alreadyPlaying: '该特典已在播放中',
    notPlaying: '当前没有正在播放的内容',
    animeNotFound: '动漫不存在',
    episodeNotFound: '分集不存在',
    extraNotFound: '特典不存在',
    noExtraFile: '该特典尚无视频文件',
    noPlayableEpisode: '没有可播放的分集',
    noEpisodeFile: '该分集尚无视频文件',
    playerUnavailable: '视频播放器不可用',
    playerStartFailed: '启动视频播放器失败',
    notWatching: '当前没有正在播放的内容',
    stopFailed: '停止视频播放器失败',
    notReading: '当前没有正在阅读的内容',
    entryNotFound: '该条目不存在',
    unitNotFound: '单元不存在',
    noReadableUnit: '还没有单元拥有可读取的文件',
    noUnitFile: '该单元尚无可读取的文件'
  }
} satisfies Messages['activity']
