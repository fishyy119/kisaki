/**
 * Shared session payload loading helpers for the scraper execution pipeline.
 */

import { assertNotAborted, isAbortError } from '@main/utils/async'
import type { SlotStrategy } from '@shared/db'
import type { BaseResolvedTarget, BaseScraperSession, ScraperProviderContext } from '../../types'
import type { PlannedProviderTask, ScraperExecutionPlan } from './planner'
import type { ScraperInvocationState } from './state'

interface SessionCapableScraperProvider<
  TTarget extends BaseResolvedTarget,
  TSession extends BaseScraperSession<TSlot, TResultMap>,
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>
> {
  readonly capabilities: readonly string[]
  openSession(target: TTarget, ctx: ScraperProviderContext): Promise<TSession>
}

export interface ExecuteScraperPlanOptions<
  TTarget extends BaseResolvedTarget,
  TSession extends BaseScraperSession<TSlot, TResultMap>,
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>,
  TResult,
  TProvider extends SessionCapableScraperProvider<TTarget, TSession, TSlot, TResultMap>
> {
  state: ScraperInvocationState<TTarget, TSession, TSlot, TResultMap, TResult>
  plan: ScraperExecutionPlan<TSlot>
  /** Cancels every provider call this plan makes; unset means uncancellable. */
  signal?: AbortSignal
  getProvider(providerId: string): TProvider | undefined
  /** Resolve locale is an invocation-level concern of the handler, not per task. */
  resolveProviderTarget(providerId: string): Promise<TTarget | null>
  collectResolvedIdentity?(context: { providerId: string; target: TTarget }): void
  buildResult(context: {
    providerId: string
    entry: PlannedProviderTask<TSlot>['entries'][number]
    data: TResultMap[TSlot]
  }): TResult | null
  warn(message: string, error?: unknown): void
}

type PlannedTaskEntry<TSlot extends string> = PlannedProviderTask<TSlot>['entries'][number]

interface SlotExecutionState {
  strategy: SlotStrategy
  closed: boolean
}

function createSlotExecutionStates<TSlot extends string>(
  plan: ScraperExecutionPlan<TSlot>
): Map<TSlot, SlotExecutionState> {
  const states = new Map<TSlot, SlotExecutionState>()
  const registerEntries = (tasks: readonly PlannedProviderTask<TSlot>[]): void => {
    for (const task of tasks) {
      for (const entry of task.entries) {
        if (!states.has(entry.slot)) {
          states.set(entry.slot, {
            strategy: entry.strategy,
            closed: false
          })
        }
      }
    }
  }

  for (const step of plan.firstWave) {
    registerEntries(step.tasks)
  }

  for (const step of plan.enrichWave) {
    registerEntries(step.tasks)
  }

  return states
}

function getPendingTaskEntries<TSlot extends string>(
  entries: readonly PlannedTaskEntry<TSlot>[],
  slotStates: ReadonlyMap<TSlot, SlotExecutionState>
): PlannedTaskEntry<TSlot>[] {
  return entries.filter((entry) => {
    const state = slotStates.get(entry.slot)
    return state?.closed === false
  })
}

function getActiveTaskEntries<TSlot extends string>(
  entries: readonly PlannedTaskEntry<TSlot>[],
  slotStates: ReadonlyMap<TSlot, SlotExecutionState>,
  capabilities: readonly string[]
): PlannedTaskEntry<TSlot>[] {
  return getPendingTaskEntries(entries, slotStates).filter((entry) =>
    capabilities.includes(entry.slot)
  )
}

/**
 * Whether a payload ends the search for a `first` slot.
 *
 * An authoritatively empty collection still answers the slot, but it gives the
 * user nothing, so the remaining providers are consulted. If they all answer
 * empty the merge keeps the empty collection rather than reporting "unknown".
 */
function satisfiesFirstStrategy(data: unknown): boolean {
  return !Array.isArray(data) || data.length > 0
}

/**
 * Result of one provider task.
 *
 * A cancellation is reported instead of thrown so waves can settle every task
 * they started before abandoning the plan; a rejection escaping a wave would
 * leave its siblings' rejections unobserved.
 */
interface ProviderTaskOutcome<TSlot extends string> {
  attemptedEntries: readonly PlannedTaskEntry<TSlot>[]
  aborted?: Error
}

async function runProviderTask<
  TTarget extends BaseResolvedTarget,
  TSession extends BaseScraperSession<TSlot, TResultMap>,
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>,
  TResult,
  TProvider extends SessionCapableScraperProvider<TTarget, TSession, TSlot, TResultMap>
>(
  task: PlannedProviderTask<TSlot>,
  slotStates: Map<TSlot, SlotExecutionState>,
  options: ExecuteScraperPlanOptions<TTarget, TSession, TSlot, TResultMap, TResult, TProvider>,
  entries: readonly PlannedTaskEntry<TSlot>[] = task.entries
): Promise<ProviderTaskOutcome<TSlot>> {
  const pendingEntries = getPendingTaskEntries(entries, slotStates)
  if (pendingEntries.length === 0) {
    return { attemptedEntries: [] }
  }

  const provider = options.getProvider(task.providerId)
  if (!provider) {
    options.warn(`Provider '${task.providerId}' not available`)
    return { attemptedEntries: pendingEntries }
  }

  const activeEntries = getActiveTaskEntries(pendingEntries, slotStates, provider.capabilities)
  if (activeEntries.length === 0) {
    return { attemptedEntries: pendingEntries }
  }

  try {
    assertNotAborted(options.signal)

    const target = await options.resolveProviderTarget(task.providerId)
    if (!target) {
      return { attemptedEntries: pendingEntries }
    }

    options.collectResolvedIdentity?.({
      providerId: task.providerId,
      target
    })

    const payloadMap = await loadSessionSlots({
      state: options.state,
      providerId: task.providerId,
      target,
      slots: activeEntries.map((entry) => entry.slot),
      ctx: { locale: task.locale, signal: options.signal },
      openSession: (resolvedTarget, ctx) => provider.openSession(resolvedTarget, ctx)
    })

    for (const entry of activeEntries) {
      const data = payloadMap[entry.slot]
      if (data === undefined) {
        continue
      }

      const result = options.buildResult({
        providerId: task.providerId,
        entry,
        data: data as TResultMap[TSlot]
      })

      if (!result) {
        continue
      }

      options.state.collect(result)

      const slotState = slotStates.get(entry.slot)
      if (slotState?.strategy === 'first' && satisfiesFirstStrategy(data)) {
        slotState.closed = true
      }
    }
  } catch (error) {
    // A cancelled invocation must not degrade into a partial scrape, so it
    // abandons the plan instead of being recorded as a provider failure.
    if (isAbortError(error)) {
      return { attemptedEntries: pendingEntries, aborted: error }
    }

    options.warn(
      `${task.providerId}.${activeEntries.map((entry) => entry.slot).join(',')} failed:`,
      error
    )
  }

  return { attemptedEntries: pendingEntries }
}

function getFirstWaveTasks<TSlot extends string>(
  plan: ScraperExecutionPlan<TSlot>
): PlannedProviderTask<TSlot>[] {
  return plan.firstWave.flatMap((step) => step.tasks)
}

function buildFirstWaveSlotQueues<TSlot extends string>(
  tasks: readonly PlannedProviderTask<TSlot>[]
): Map<TSlot, PlannedProviderTask<TSlot>[]> {
  const queues = new Map<TSlot, PlannedProviderTask<TSlot>[]>()

  for (const task of tasks) {
    for (const entry of task.entries) {
      if (entry.strategy !== 'first') {
        continue
      }

      const queue = queues.get(entry.slot)
      if (queue) {
        queue.push(task)
        continue
      }

      queues.set(entry.slot, [task])
    }
  }

  return queues
}

function getCurrentFirstWaveTaskForSlot<TSlot extends string>(
  slot: TSlot,
  queues: ReadonlyMap<TSlot, readonly PlannedProviderTask<TSlot>[]>,
  progress: ReadonlyMap<TSlot, number>
): PlannedProviderTask<TSlot> | undefined {
  const queue = queues.get(slot)
  if (!queue) {
    return undefined
  }

  return queue[progress.get(slot) ?? 0]
}

function areTaskFirstEntriesSettled<TSlot extends string>(
  task: PlannedProviderTask<TSlot>,
  slotStates: ReadonlyMap<TSlot, SlotExecutionState>,
  executedEntries: ReadonlySet<PlannedTaskEntry<TSlot>>
): boolean {
  return task.entries.every((entry) => {
    if (entry.strategy !== 'first') {
      return true
    }

    if (executedEntries.has(entry)) {
      return true
    }

    const state = slotStates.get(entry.slot)
    return !state || state.closed
  })
}

function getReadyFirstWaveTaskEntries<TSlot extends string>(
  task: PlannedProviderTask<TSlot>,
  slotStates: ReadonlyMap<TSlot, SlotExecutionState>,
  queues: ReadonlyMap<TSlot, readonly PlannedProviderTask<TSlot>[]>,
  progress: ReadonlyMap<TSlot, number>,
  executedEntries: ReadonlySet<PlannedTaskEntry<TSlot>>
): PlannedTaskEntry<TSlot>[] {
  const readyFirstEntries = task.entries.filter((entry) => {
    if (entry.strategy !== 'first' || executedEntries.has(entry)) {
      return false
    }

    const state = slotStates.get(entry.slot)
    if (!state || state.closed) {
      return false
    }

    return getCurrentFirstWaveTaskForSlot(entry.slot, queues, progress) === task
  })

  const pendingEnrichEntries = task.entries.filter((entry) => {
    if (entry.strategy !== 'enrich' || executedEntries.has(entry)) {
      return false
    }

    const state = slotStates.get(entry.slot)
    return state?.closed === false
  })

  if (readyFirstEntries.length > 0) {
    return [...readyFirstEntries, ...pendingEnrichEntries]
  }

  if (
    pendingEnrichEntries.length > 0 &&
    areTaskFirstEntriesSettled(task, slotStates, executedEntries)
  ) {
    return pendingEnrichEntries
  }

  return []
}

async function executeFirstWave<
  TTarget extends BaseResolvedTarget,
  TSession extends BaseScraperSession<TSlot, TResultMap>,
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>,
  TResult,
  TProvider extends SessionCapableScraperProvider<TTarget, TSession, TSlot, TResultMap>
>(
  plan: ScraperExecutionPlan<TSlot>,
  slotStates: Map<TSlot, SlotExecutionState>,
  options: ExecuteScraperPlanOptions<TTarget, TSession, TSlot, TResultMap, TResult, TProvider>
): Promise<void> {
  const tasks = getFirstWaveTasks(plan)
  if (tasks.length === 0) {
    return
  }

  const slotQueues = buildFirstWaveSlotQueues(tasks)
  const slotProgress = new Map<TSlot, number>()
  const executedEntries = new Set<PlannedTaskEntry<TSlot>>()
  const runningTasks = new Map<
    PlannedProviderTask<TSlot>,
    Promise<ProviderTaskOutcome<TSlot> & { task: PlannedProviderTask<TSlot> }>
  >()
  let aborted: Error | undefined

  // First-slot fallbacks advance per slot. Shared provider tasks can still batch
  // whichever first entries are ready now, then pick up the remaining ones later.
  const scheduleReadyTasks = (): void => {
    if (aborted) {
      return
    }

    for (const task of tasks) {
      if (runningTasks.has(task)) {
        continue
      }

      const readyEntries = getReadyFirstWaveTaskEntries(
        task,
        slotStates,
        slotQueues,
        slotProgress,
        executedEntries
      )
      if (readyEntries.length === 0) {
        continue
      }

      const execution = runProviderTask(task, slotStates, options, readyEntries).then(
        (outcome) => ({ task, ...outcome })
      )
      runningTasks.set(task, execution)
    }
  }

  scheduleReadyTasks()

  while (runningTasks.size > 0) {
    const outcome = await Promise.race(Array.from(runningTasks.values()))
    runningTasks.delete(outcome.task)
    aborted ??= outcome.aborted

    for (const entry of outcome.attemptedEntries) {
      executedEntries.add(entry)

      if (entry.strategy !== 'first') {
        continue
      }

      if (getCurrentFirstWaveTaskForSlot(entry.slot, slotQueues, slotProgress) !== outcome.task) {
        continue
      }

      slotProgress.set(entry.slot, (slotProgress.get(entry.slot) ?? 0) + 1)
    }

    scheduleReadyTasks()
  }

  if (aborted) {
    throw aborted
  }
}

async function executeEnrichWave<
  TTarget extends BaseResolvedTarget,
  TSession extends BaseScraperSession<TSlot, TResultMap>,
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>,
  TResult,
  TProvider extends SessionCapableScraperProvider<TTarget, TSession, TSlot, TResultMap>
>(
  plan: ScraperExecutionPlan<TSlot>,
  slotStates: Map<TSlot, SlotExecutionState>,
  options: ExecuteScraperPlanOptions<TTarget, TSession, TSlot, TResultMap, TResult, TProvider>
): Promise<void> {
  for (const step of plan.enrichWave) {
    const outcomes = await Promise.all(
      step.tasks.map((task) => runProviderTask(task, slotStates, options))
    )

    const aborted = outcomes.find((outcome) => outcome.aborted)?.aborted
    if (aborted) {
      throw aborted
    }
  }
}

/**
 * Execute a planned scrape using invocation-scoped resolve/session/payload caches.
 */
export async function executeScraperPlan<
  TTarget extends BaseResolvedTarget,
  TSession extends BaseScraperSession<TSlot, TResultMap>,
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>,
  TResult,
  TProvider extends SessionCapableScraperProvider<TTarget, TSession, TSlot, TResultMap>
>(
  options: ExecuteScraperPlanOptions<TTarget, TSession, TSlot, TResultMap, TResult, TProvider>
): Promise<readonly TResult[]> {
  const slotStates = createSlotExecutionStates(options.plan)

  await executeFirstWave(options.plan, slotStates, options)
  await executeEnrichWave(options.plan, slotStates, options)

  return options.state.getCollectedResults()
}

/**
 * Load one or more slot payloads while sharing the same provider session fetch.
 */
async function loadSessionSlots<
  TTarget extends BaseResolvedTarget,
  TSession extends BaseScraperSession<TSlot, TResultMap>,
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>,
  TResult
>(options: {
  state: ScraperInvocationState<TTarget, TSession, TSlot, TResultMap, TResult>
  providerId: string
  target: TTarget
  slots: readonly TSlot[]
  ctx: ScraperProviderContext
  openSession: (target: TTarget, ctx: ScraperProviderContext) => Promise<TSession>
}): Promise<Partial<TResultMap>> {
  const locale = options.ctx.locale
  const missingSlots: TSlot[] = []

  for (const slot of options.slots) {
    if (!options.state.getPayloadTask(options.providerId, options.target, slot, locale)) {
      missingSlots.push(slot)
    }
  }

  if (missingSlots.length > 0) {
    const sessionTask = options.state.getOrCreateSession(
      options.providerId,
      options.target,
      locale,
      () => options.openSession(options.target, options.ctx)
    )

    const fetchTask = (async () => {
      const session = await sessionTask
      const result = await session.get(missingSlots)
      if (result.identity) {
        options.state.collectIdentity(result.identity)
      }
      return result.slots
    })()

    for (const slot of missingSlots) {
      options.state.setPayloadTask(
        options.providerId,
        options.target,
        slot,
        locale,
        fetchTask.then((result) => {
          const payload = result[slot]
          return payload === undefined ? null : (payload as TResultMap[typeof slot])
        })
      )
    }
  }

  const output = {} as Partial<TResultMap>

  for (const slot of options.slots) {
    const payloadTask = options.state.getPayloadTask<TResultMap[TSlot]>(
      options.providerId,
      options.target,
      slot,
      locale
    )
    const payload = payloadTask ? await payloadTask : null
    if (payload !== null) {
      output[slot] = payload as TResultMap[TSlot]
    }
  }

  return output
}
