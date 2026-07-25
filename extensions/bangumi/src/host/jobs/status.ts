import { kisaki } from '@kisaki3/extension-sdk'
import type { BangumiActiveJobsState } from '../../shared/settings'
import { BangumiExtensionError } from '../utils/errors'
import { m } from '../i18n'
import { BANGUMI_COMMAND_IDS, type BangumiCommandId } from './commands'

export async function isBangumiCommandActive(commandId: BangumiCommandId): Promise<boolean> {
  const runs = await kisaki.taskRuns.listActiveOwn({
    subject: { type: 'command', id: commandId },
    limit: 1
  })
  return runs.length > 0
}

export async function assertBangumiCommandIdle(commandId: BangumiCommandId): Promise<void> {
  if (await isBangumiCommandActive(commandId)) {
    throw new BangumiExtensionError('bangumi_job_running', m().errors.jobAlreadyRunning)
  }
}

export async function resolveActiveBangumiJobs(): Promise<BangumiActiveJobsState> {
  const [accountRefresh, syncChangedItems, syncFull, importCollections, importIndex] =
    await Promise.all([
      isBangumiCommandActive(BANGUMI_COMMAND_IDS.authRefresh),
      isBangumiCommandActive(BANGUMI_COMMAND_IDS.syncChangedItems),
      isBangumiCommandActive(BANGUMI_COMMAND_IDS.syncFull),
      isBangumiCommandActive(BANGUMI_COMMAND_IDS.importCollections),
      isBangumiCommandActive(BANGUMI_COMMAND_IDS.importIndex)
    ])

  return { accountRefresh, syncChangedItems, syncFull, importCollections, importIndex }
}
