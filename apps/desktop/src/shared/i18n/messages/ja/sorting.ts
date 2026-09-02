import type { Messages } from '../schema'

/** Sort control vocabulary shared by every sortable list. */
export const sorting = {
  ascending: '昇順',
  descending: '降順',
  directionFixed: 'この並び順は方向が固定です'
} satisfies Messages['sorting']
