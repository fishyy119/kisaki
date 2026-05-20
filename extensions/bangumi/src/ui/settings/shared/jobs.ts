import { kisaki, type CommandListItem, type SerializableRecord } from '@kisaki/extension-sdk'
import { BANGUMI_COMMAND_IDS, type BangumiCommandId } from '../../../jobs/commands'
import type { BangumiSettingsRootButtonEvent, BangumiSettingsRootButtonResult } from '../contracts'
import type {
  BangumiSettingsDialogButtonEvent,
  BangumiSettingsDialogButtonResult,
  BangumiSettingsDialogSubmitEvent,
  BangumiSettingsDialogSubmitResult
} from './types'

export interface BangumiRunningJobs {
  accountRefresh: boolean
  syncFull: boolean
  importMyCollections: boolean
  importIndex: boolean
}

export async function resolveRunningJobs(): Promise<BangumiRunningJobs> {
  const commands = await kisaki.commands.list()

  return {
    accountRefresh: isCommandRunning(commands, BANGUMI_COMMAND_IDS.authRefresh),
    syncFull: isCommandRunning(commands, BANGUMI_COMMAND_IDS.syncFull),
    importMyCollections: isCommandRunning(commands, BANGUMI_COMMAND_IDS.importMyCollections),
    importIndex: isCommandRunning(commands, BANGUMI_COMMAND_IDS.importIndex)
  }
}

export async function isBangumiCommandRunning(commandId: BangumiCommandId): Promise<boolean> {
  return isCommandRunning(await kisaki.commands.list(), commandId)
}

export async function startRootManualJob(options: {
  commandId: BangumiCommandId
  args: SerializableRecord
  event: BangumiSettingsRootButtonEvent
}): Promise<BangumiSettingsRootButtonResult> {
  if (await isBangumiCommandRunning(options.commandId)) {
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
  if (await isBangumiCommandRunning(options.commandId)) {
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
  await kisaki.commands.start({
    commandId,
    args,
    presentation: {
      notify: {
        enabled: true,
        title: formatJobNotificationTitle(commandId, args),
        message: isDryRunJob(args) ? '正在生成预览...' : '正在执行...',
        cancelable: true
      }
    }
  })
}

function createRunningJobError() {
  return {
    code: 'bangumi_job_running',
    message: '该 Bangumi 任务正在运行，请先等待完成或取消。'
  }
}

function isCommandRunning(
  commands: readonly CommandListItem[],
  commandId: BangumiCommandId
): boolean {
  return commands.some((command) => command.id === commandId && command.running)
}

function formatJobNotificationTitle(commandId: BangumiCommandId, args: SerializableRecord): string {
  const base = (() => {
    switch (commandId) {
      case BANGUMI_COMMAND_IDS.authRefresh:
        return 'Bangumi 刷新凭据'
      case BANGUMI_COMMAND_IDS.syncChangedGames:
        return 'Bangumi 同步变更'
      case BANGUMI_COMMAND_IDS.syncFull:
        return 'Bangumi 全量同步'
      case BANGUMI_COMMAND_IDS.importMyCollections:
        return 'Bangumi 导入我的收藏'
      case BANGUMI_COMMAND_IDS.importIndex:
        return 'Bangumi 导入目录'
      default:
        return 'Bangumi job'
    }
  })()

  return isDryRunJob(args) && commandId !== BANGUMI_COMMAND_IDS.authRefresh ? `${base}预览` : base
}

function isDryRunJob(args: SerializableRecord): boolean {
  return args.dryRun === true
}

export { BANGUMI_COMMAND_IDS }
