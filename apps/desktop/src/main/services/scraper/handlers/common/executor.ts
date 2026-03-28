/**
 * Shared session payload loading helpers for the scraper execution pipeline.
 */

import type { Locale } from '@shared/locale'
import type { SlotStrategy } from '@shared/db'
import type { BaseResolvedTarget, BaseScraperSession } from '../../types'
import type { PlannedProviderTask, ScraperExecutionPlan } from './planner'
import type { ScraperInvocationState } from './state'

interface SessionCapableScraperProvider<
  TTarget extends BaseResolvedTarget,
  TSession extends BaseScraperSession<TSlot, TResultMap>,
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>
> {
  readonly capabilities: readonly string[]
  openSession(target: TTarget, locale: Locale): Promise<TSession>
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
  getProvider(providerId: string): TProvider | undefined
  resolveProviderTarget(providerId: string, locale: Locale): Promise<TTarget | null>
  buildResult(context: {
    providerId: string
    target: TTarget
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
): Promise<readonly PlannedTaskEntry<TSlot>[]> {
  const pendingEntries = getPendingTaskEntries(entries, slotStates)
  if (pendingEntries.length === 0) {
    return []
  }

  const provider = options.getProvider(task.providerId)
  if (!provider) {
    options.warn(`[Scraper] Provider '${task.providerId}' not available`)
    return pendingEntries
  }

  const activeEntries = getActiveTaskEntries(pendingEntries, slotStates, provider.capabilities)
  if (activeEntries.length === 0) {
    return pendingEntries
  }

  try {
    const target = await options.resolveProviderTarget(task.providerId, task.locale)
    if (!target) {
      return pendingEntries
    }

    const payloadMap = await loadSessionSlots({
      state: options.state,
      providerId: task.providerId,
      target,
      slots: activeEntries.map((entry) => entry.slot),
      locale: task.locale,
      openSession: (resolvedTarget, locale) => provider.openSession(resolvedTarget, locale)
    })

    for (const entry of activeEntries) {
      const data = payloadMap[entry.slot]
      if (data === undefined) {
        continue
      }

      const result = options.buildResult({
        providerId: task.providerId,
        target,
        entry,
        data: data as TResultMap[TSlot]
      })

      if (!result) {
        continue
      }

      options.state.collect(result)

      const slotState = slotStates.get(entry.slot)
      if (slotState?.strategy === 'first') {
        slotState.closed = true
      }
    }
  } catch (error) {
    options.warn(
      `[Scraper] ${task.providerId}.${activeEntries.map((entry) => entry.slot).join(',')} failed:`,
      error
    )
  }

  return pendingEntries
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
    Promise<{
      task: PlannedProviderTask<TSlot>
      attemptedEntries: readonly PlannedTaskEntry<TSlot>[]
    }>
  >()

  // First-slot fallbacks advance per slot. Shared provider tasks can still batch
  // whichever first entries are ready now, then pick up the remaining ones later.
  const scheduleReadyTasks = (): void => {
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
        (attemptedEntries) => ({
          task,
          attemptedEntries
        })
      )
      runningTasks.set(task, execution)
    }
  }

  scheduleReadyTasks()

  while (runningTasks.size > 0) {
    const { task, attemptedEntries } = await Promise.race(Array.from(runningTasks.values()))
    runningTasks.delete(task)

    for (const entry of attemptedEntries) {
      executedEntries.add(entry)

      if (entry.strategy !== 'first') {
        continue
      }

      if (getCurrentFirstWaveTaskForSlot(entry.slot, slotQueues, slotProgress) !== task) {
        continue
      }

      slotProgress.set(entry.slot, (slotProgress.get(entry.slot) ?? 0) + 1)
    }

    scheduleReadyTasks()
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
    await Promise.all(step.tasks.map((task) => runProviderTask(task, slotStates, options)))
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
 * Load a single slot payload through an invocation-scoped session and payload cache.
 */
export async function loadSessionSlot<
  TTarget extends BaseResolvedTarget,
  TSession extends BaseScraperSession<TSlot, TResultMap>,
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>,
  TResult
>(options: {
  state: ScraperInvocationState<TTarget, TSession, TSlot, TResultMap, TResult>
  providerId: string
  target: TTarget
  slot: TSlot
  locale: Locale
  openSession: (target: TTarget, locale: Locale) => Promise<TSession>
}): Promise<TResultMap[TSlot] | null> {
  const results = await loadSessionSlots({
    state: options.state,
    providerId: options.providerId,
    target: options.target,
    slots: [options.slot],
    locale: options.locale,
    openSession: options.openSession
  })

  const payload = results[options.slot]
  return payload === undefined ? null : (payload as TResultMap[TSlot])
}

/**
 * Load one or more slot payloads while sharing the same provider session fetch.
 */
export async function loadSessionSlots<
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
  locale: Locale
  openSession: (target: TTarget, locale: Locale) => Promise<TSession>
}): Promise<Partial<TResultMap>> {
  const missingSlots: TSlot[] = []

  for (const slot of options.slots) {
    if (!options.state.getPayloadTask(options.providerId, options.target, slot, options.locale)) {
      missingSlots.push(slot)
    }
  }

  if (missingSlots.length > 0) {
    const sessionTask = options.state.getOrCreateSession(
      options.providerId,
      options.target,
      options.locale,
      () => options.openSession(options.target, options.locale)
    )

    const fetchTask = (async () => {
      const session = await sessionTask
      return session.get(missingSlots)
    })()

    for (const slot of missingSlots) {
      options.state.setPayloadTask(
        options.providerId,
        options.target,
        slot,
        options.locale,
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
      options.locale
    )
    const payload = payloadTask ? await payloadTask : null
    if (payload !== null) {
      output[slot] = payload as TResultMap[TSlot]
    }
  }

  return output
}
