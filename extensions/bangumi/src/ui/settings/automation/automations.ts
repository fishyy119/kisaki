import { kisaki, type Automation } from '@kisaki3/extension-sdk'
import { BANGUMI_COMMAND_IDS } from '../shared/jobs'

export async function listBangumiAutomations(): Promise<readonly Automation[]> {
  try {
    const automations = await kisaki.automations.list()
    const commandIds = new Set<string>(Object.values(BANGUMI_COMMAND_IDS))
    return automations.filter((automation) => commandIds.has(automation.commandId))
  } catch {
    return []
  }
}
