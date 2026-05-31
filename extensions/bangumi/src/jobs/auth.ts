import type { BangumiAuthRefreshArgs } from './args'
import {
  runBangumiJob,
  type BangumiJobRun,
  type JobRunnerDependencies
} from './context'
import type { BangumiJobSummary } from './summary'

export class AuthJobRunner {
  constructor(private readonly deps: JobRunnerDependencies) {}

  runAuthRefresh(
    args: BangumiAuthRefreshArgs,
    context: BangumiJobRun
  ): Promise<BangumiJobSummary> {
    return runBangumiJob(context, this.deps.logger, async (job) => {
      job.report('refreshingToken', '正在刷新 Bangumi 凭据...', { indeterminate: true })

      if (args.forceRefresh) {
        await this.deps.tokenService.refreshAccessToken({
          forceRefresh: true,
          signal: job.signal
        })
        job.increment('refreshed')
      } else {
        await this.deps.tokenService.getAccessToken({ signal: job.signal })
        job.increment('checkedToken')
      }

      if (args.verifyAccount) {
        job.report('verifyingAccount', '正在验证 Bangumi 账号...', { indeterminate: true })
        const verification = await this.deps.accountService.verifyAccount(job.signal)
        job.increment('verified')
        job.report('completed', `Bangumi 账号有效：${verification.account.nickname}`, {
          current: 1,
          total: 1
        })
      } else {
        const account = await this.deps.accountService.refreshAccount(job.signal)
        job.increment('accountRefreshed')
        job.report('completed', `Bangumi 账号摘要已更新：${account.nickname}`, {
          current: 1,
          total: 1
        })
      }
    })
  }
}
