import {
  kisaki,
  type CommandInvocationResult,
  type SerializableRecord
} from '@kisaki3/extension-sdk'
import { BANGUMI_COMMAND_IDS, type BangumiCommandId } from '../../../jobs/commands'
import type { BangumiSettingsRootButtonEvent, BangumiSettingsRootButtonResult } from '../contracts'
import type {
  BangumiSettingsDialogButtonEvent,
  BangumiSettingsDialogButtonResult,
  BangumiSettingsDialogSubmitEvent,
  BangumiSettingsDialogSubmitResult
} from './types'

export interface BangumiActiveJobs {
  accountRefresh: boolean
  syncChangedItems: boolean
  syncFull: boolean
  importCollections: boolean
  importIndex: boolean
}

export async function resolveActiveJobs(): Promise<BangumiActiveJobs> {
  return {
    accountRefresh: false,
    syncChangedItems: false,
    syncFull: false,
    importCollections: false,
    importIndex: false
  }
}

export async function isBangumiCommandActive(commandId: BangumiCommandId): Promise<boolean> {
  void commandId
  return false
}

export async function startRootManualJob(options: {
  commandId: BangumiCommandId
  args: SerializableRecord
  event: BangumiSettingsRootButtonEvent
}): Promise<BangumiSettingsRootButtonResult> {
  if (await isBangumiCommandActive(options.commandId)) {
    return options.event.fail(createRunningJobError(), { refresh: 'root' })
  }

  await startCommandJob(options)
  return options.event.success({
    refresh: 'root'
  })
}

export function startDialogManualJob<
  TParams extends SerializableRecord = SerializableRecord
>(options: {
  commandId: BangumiCommandId
  args: SerializableRecord
  event: BangumiSettingsDialogButtonEvent<TParams>
}): Promise<BangumiSettingsDialogButtonResult>
export function startDialogManualJob<
  TParams extends SerializableRecord = SerializableRecord
>(options: {
  commandId: BangumiCommandId
  args: SerializableRecord
  event: BangumiSettingsDialogSubmitEvent<TParams>
}): Promise<BangumiSettingsDialogSubmitResult>
export async function startDialogManualJob<
  TParams extends SerializableRecord = SerializableRecord
>(options: {
  commandId: BangumiCommandId
  args: SerializableRecord
  event: BangumiSettingsDialogButtonEvent<TParams> | BangumiSettingsDialogSubmitEvent<TParams>
}): Promise<BangumiSettingsDialogButtonResult | BangumiSettingsDialogSubmitResult> {
  if (await isBangumiCommandActive(options.commandId)) {
    return options.event.fail(createRunningJobError(), { refresh: 'dialog' })
  }

  await startCommandJob(options)
  return options.event.success({
    refresh: 'dialog'
  })
}

export function formatDateTime(value: number | null | undefined): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false
  })
}

async function startCommandJob({
  commandId,
  args
}: {
  commandId: BangumiCommandId
  args: SerializableRecord
}): Promise<void> {
  await startBangumiCommandJob(commandId, args)
}

export async function startBangumiCommandJob(
  commandId: BangumiCommandId,
  args: SerializableRecord
): Promise<CommandInvocationResult> {
  return await kisaki.commands.invoke({
    commandId,
    args
  })
}

export function createRunningJobError() {
  return {
    code: 'bangumi_job_running',
    message: '该 Bangumi 任务正在运行，请先等待完成或取消。'
  }
}

export { BANGUMI_COMMAND_IDS }
