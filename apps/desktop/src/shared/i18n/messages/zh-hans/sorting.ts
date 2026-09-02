import type { Messages } from '../schema'

/** Sort control vocabulary shared by every sortable list. */
export const sorting = {
  ascending: '升序',
  descending: '降序',
  directionFixed: '此排序方向固定'
} satisfies Messages['sorting']
