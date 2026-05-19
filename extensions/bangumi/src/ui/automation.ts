import { kisaki, type BackgroundTask } from '@kisaki/extension-sdk'
import type { BangumiSettingsV1 } from '../config/schema'
import { BANGUMI_COMMAND_IDS } from './common/jobs'
import { toSettingsError } from './common/errors'
import type { BangumiSettingsRootFactory, BangumiSettingsRootField } from './common/types'

const TASK_FAILURE_POLICY = {
  type: 'retry',
  retryCount: 2,
  retryDelayMs: 60_000
} as const

export async function listBangumiAutomationTasks(): Promise<readonly BackgroundTask[]> {
  try {
    const tasks = await kisaki.backgroundTasks.list()
    const commandIds = new Set<string>(Object.values(BANGUMI_COMMAND_IDS))
    return tasks.filter((task) => commandIds.has(task.commandId))
  } catch {
    return []
  }
}

export function createAutomationFields({
  settings,
  storedSettings,
  tasks
}: {
  settings: BangumiSettingsRootFactory
  storedSettings: BangumiSettingsV1
  tasks: readonly BackgroundTask[]
}): BangumiSettingsRootField[] {
  return [
    createTaskField({
      settings,
      id: 'task-auth-refresh-startup',
      label: '启动时刷新凭据',
      existingTask: findTask(tasks, BANGUMI_COMMAND_IDS.authRefresh),
      create: () =>
        kisaki.backgroundTasks.create({
          name: 'Bangumi 启动时刷新凭据',
          commandId: BANGUMI_COMMAND_IDS.authRefresh,
          args: {
            forceRefresh: true,
            verifyAccount: true
          },
          enabled: true,
          schedule: { type: 'onStartup' },
          failurePolicy: TASK_FAILURE_POLICY
        })
    }),
    createTaskField({
      settings,
      id: 'task-sync-changed-startup',
      label: '启动后同步变更队列',
      existingTask: findTask(tasks, BANGUMI_COMMAND_IDS.syncChangedGames),
      create: () =>
        kisaki.backgroundTasks.create({
          name: 'Bangumi 启动后同步变更队列',
          commandId: BANGUMI_COMMAND_IDS.syncChangedGames,
          args: {
            dryRun: false,
            limit: 500
          },
          enabled: true,
          schedule: { type: 'onStartup' },
          failurePolicy: TASK_FAILURE_POLICY
        })
    }),
    createTaskField({
      settings,
      id: 'task-full-sync-daily',
      label: '每日全量同步',
      existingTask: findTask(tasks, BANGUMI_COMMAND_IDS.syncFull),
      create: () =>
        kisaki.backgroundTasks.create({
          name: 'Bangumi 每日全量同步',
          commandId: BANGUMI_COMMAND_IDS.syncFull,
          args: {
            dryRun: false,
            updateExisting: true,
            playStatusEnabled: storedSettings.autoSync.playStatusEnabled,
            scoreEnabled: storedSettings.autoSync.scoreEnabled,
            clearRemoteScoreWhenEmpty: storedSettings.autoSync.clearRemoteScoreWhenEmpty,
            batchSize: 100
          },
          enabled: true,
          schedule: { type: 'daily', timeOfDay: '04:00' },
          failurePolicy: TASK_FAILURE_POLICY
        })
    })
  ]
}

function createTaskField({
  settings,
  id,
  label,
  existingTask,
  create
}: {
  settings: BangumiSettingsRootFactory
  id: string
  label: string
  existingTask?: BackgroundTask
  create: () => Promise<BackgroundTask>
}): BangumiSettingsRootField {
  return {
    id,
    label,
    orientation: 'horizontal',
    contentLayout: 'inline',
    content: [
      settings.status({
        id: `${id}.status`,
        tone: existingTask?.enabled ? 'success' : existingTask ? 'warning' : 'neutral',
        value: existingTask ? (existingTask.enabled ? '已创建' : '已停用') : '未创建'
      }),
      settings.button({
        id: `${id}.create`,
        label: '创建',
        tone: 'primary',
        disabled: !!existingTask,
        async onClick(event) {
          try {
            await create()
            return event.success({
              message: `${label}任务已创建。`,
              refresh: 'root'
            })
          } catch (error) {
            return event.fail(toSettingsError(error), { refresh: 'root' })
          }
        }
      })
    ]
  }
}

function findTask(tasks: readonly BackgroundTask[], commandId: string): BackgroundTask | undefined {
  return tasks.find((task) => task.commandId === commandId)
}
