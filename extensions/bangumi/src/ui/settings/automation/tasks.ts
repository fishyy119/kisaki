import { kisaki, type BackgroundTask } from '@kisaki/extension-sdk'
import { BANGUMI_COMMAND_IDS } from '../shared/jobs'

export async function listBangumiAutomationTasks(): Promise<readonly BackgroundTask[]> {
  try {
    const tasks = await kisaki.backgroundTasks.list()
    const commandIds = new Set<string>(Object.values(BANGUMI_COMMAND_IDS))
    return tasks.filter((task) => commandIds.has(task.commandId))
  } catch {
    return []
  }
}
