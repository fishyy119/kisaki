/** Runs tasks with a bounded number of in-flight promises, preserving order. */
export async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  task: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length)
  let cursor = 0

  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () =>
    (async () => {
      for (;;) {
        const index = cursor
        cursor += 1
        if (index >= items.length) {
          return
        }
        results[index] = await task(items[index]!, index)
      }
    })()
  )

  await Promise.all(workers)
  return results
}
