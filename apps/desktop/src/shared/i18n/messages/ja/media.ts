import type { Messages } from '../schema'

export const media = {
  player: {
    starting: '起動中',
    playing: '再生中',
    paused: '一時停止中'
  }
} satisfies Messages['media']
