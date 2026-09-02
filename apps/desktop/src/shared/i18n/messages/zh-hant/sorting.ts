import type { Messages } from '../schema'

/** Sort control vocabulary shared by every sortable list. */
export const sorting = {
  ascending: '升冪',
  descending: '降冪',
  directionFixed: '此排序方向固定'
} satisfies Messages['sorting']
