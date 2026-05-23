import { defineSettingsPanelTab, kisaki, type BackgroundTask } from '@kisaki/extension-sdk'
import type {
  BangumiSettingsRootField,
  BangumiSettingsRootScope,
  BangumiSettingsTab
} from '../contracts'
import { BANGUMI_COMMAND_IDS } from '../shared/jobs'
import { toSettingsError } from '../shared/errors'

const TASK_FAILURE_POLICY = {
  type: 'retry',
  retryCount: 2,
  retryDelayMs: 60_000
} as const

export async function resolveAutomationTab(
  scope: BangumiSettingsRootScope
): Promise<BangumiSettingsTab> {
  const [storedSettings, tasks] = await Promise.all([
    scope.resources.settings(),
    scope.resources.automationTasks()
  ])

  return defineSettingsPanelTab({
    id: 'automation',
    label: '自动化',
    fields: [
      createTaskField({
        scope,
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
            triggers: { onStartup: true },
            failurePolicy: TASK_FAILURE_POLICY
          })
      }),
      createTaskField({
        scope,
        id: 'task-sync-changed-startup',
        label: '启动后同步变更队列',
        existingTask: findTask(tasks, BANGUMI_COMMAND_IDS.syncChangedItems),
        create: () =>
          kisaki.backgroundTasks.create({
            name: 'Bangumi 启动后同步变更队列',
            commandId: BANGUMI_COMMAND_IDS.syncChangedItems,
            args: {
              scope: 'game',
              dryRun: false,
              limit: 500
            },
            enabled: true,
            triggers: { onStartup: true },
            failurePolicy: TASK_FAILURE_POLICY
          })
      }),
      createTaskField({
        scope,
        id: 'task-full-sync-daily',
        label: '每日全量同步',
        existingTask: findTask(tasks, BANGUMI_COMMAND_IDS.syncFull),
        create: () =>
          kisaki.backgroundTasks.create({
            name: 'Bangumi 每日全量同步',
            commandId: BANGUMI_COMMAND_IDS.syncFull,
            args: {
              scope: 'game',
              dryRun: false,
              updateExisting: true,
              playStatusEnabled: storedSettings.game.autoSync.playStatusEnabled,
              scoreEnabled: storedSettings.game.autoSync.scoreEnabled,
              clearRemoteScoreWhenEmpty: storedSettings.game.autoSync.clearRemoteScoreWhenEmpty,
              batchSize: 100
            },
            enabled: true,
            triggers: {
              onStartup: false,
              cron: { expression: '0 4 * * *' }
            },
            failurePolicy: TASK_FAILURE_POLICY
          })
      })
    ]
  })
}

function createTaskField({
  scope,
  id,
  label,
  existingTask,
  create
}: {
  scope: BangumiSettingsRootScope
  id: string
  label: string
  existingTask?: BackgroundTask
  create: () => Promise<BackgroundTask>
}): BangumiSettingsRootField {
  const { ui } = scope

  return {
    id,
    label,
    orientation: 'horizontal',
    contentLayout: 'inline',
    content: [
      ui.status({
        id: `${id}.status`,
        tone: existingTask?.enabled ? 'success' : existingTask ? 'warning' : 'neutral',
        value: existingTask ? (existingTask.enabled ? '已创建' : '已停用') : '未创建'
      }),
      ui.button({
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
