import type { Messages } from '../schema'

export const media = {
  player: {
    starting: '启动中',
    playing: '播放中',
    paused: '已暂停'
  }
} satisfies Messages['media']
