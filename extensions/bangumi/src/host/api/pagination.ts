export interface Page<T> {
  items: readonly T[]
  total?: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface PageQuery {
  limit?: number
  offset?: number
}

export interface BangumiPagedLike<T> {
  total?: number
  limit?: number
  offset?: number
  data?: readonly T[]
}

const DEFAULT_LIMIT = 50

export function normalizePageQuery(query: PageQuery = {}): Required<PageQuery> {
  return {
    limit: normalizePositiveInteger(query.limit, DEFAULT_LIMIT),
    offset: normalizeNonNegativeInteger(query.offset, 0)
  }
}

export function toPage<T>(response: BangumiPagedLike<T>, query: Required<PageQuery>): Page<T> {
  const items = Array.isArray(response.data) ? response.data : []
  const total = normalizeOptionalNonNegativeInteger(response.total)
  const limit = normalizePositiveInteger(response.limit, query.limit)
  const offset = normalizeNonNegativeInteger(response.offset, query.offset)

  return {
    items,
    ...(total !== undefined ? { total } : {}),
    limit,
    offset,
    hasMore: total !== undefined ? offset + items.length < total : items.length >= limit
  }
}

export async function collectPages<T>(
  load: (query: Required<PageQuery>) => Promise<Page<T>>,
  query: PageQuery = {}
): Promise<T[]> {
  const firstQuery = normalizePageQuery(query)
  const items: T[] = []
  let nextQuery = firstQuery

  while (true) {
    const page = await load(nextQuery)
    items.push(...page.items)

    if (!page.hasMore) {
      return items
    }

    nextQuery = {
      limit: page.limit,
      offset: page.offset + page.items.length
    }
  }
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : fallback
}

function normalizeNonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : fallback
}

function normalizeOptionalNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : undefined
}
