import type { Messages } from '../schema'

export const media = {
  player: {
    starting: '啟動中',
    playing: '播放中',
    paused: '已暫停'
  }
} satisfies Messages['media']
