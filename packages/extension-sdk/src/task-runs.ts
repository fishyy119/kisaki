import type { TaskRunProgressWork } from '@kisaki3/extension-api'

export type TaskRunProgressWorkInput = Partial<
  Pick<TaskRunProgressWork, 'current' | 'total' | 'unit' | 'ratePeriod' | 'indeterminate'>
>

/**
 * Builds a progress `work` payload from partial inputs: amounts default the
 * unit to `item`, and empty input collapses to `undefined` so callers can pass
 * the result straight into a progress update.
 */
export function createTaskRunProgressWork(
  input: TaskRunProgressWorkInput = {}
): TaskRunProgressWork | undefined {
  const work: TaskRunProgressWork = {}
  if (input.current !== undefined) {
    work.current = input.current
  }
  if (input.total !== undefined) {
    work.total = input.total
  }
  if (input.current !== undefined || input.total !== undefined) {
    work.unit = input.unit ?? 'item'
  } else if (input.unit !== undefined) {
    work.unit = input.unit
  }
  if (input.ratePeriod !== undefined) {
    work.ratePeriod = input.ratePeriod
  }
  if (input.indeterminate !== undefined) {
    work.indeterminate = input.indeterminate
  }

  return Object.keys(work).length > 0 ? work : undefined
}
