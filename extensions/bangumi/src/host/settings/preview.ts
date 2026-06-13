import {
  TaskRunCancellation,
  type TaskRunProgressUpdate,
  type TaskRunResult
} from '@kisaki3/extension-sdk'
import type { BangumiJobHandle } from '../jobs/runner'
import { assertBangumiCommandIdle } from '../jobs/status'
import type { BangumiCommandId } from '../jobs/commands'
import type { BangumiJobSummary } from '../jobs/summary'
import type { BangumiPreviewGroupDto } from '../../shared/settings'
import type { BangumiSettingsSession } from './session'

type PreviewResult = Omit<TaskRunResult, 'status' | 'error'>

/**
 * Runs a preview through the regular job runner code paths. Previews are
 * request/response over webview RPC: progress is pushed into the document and
 * no task run or notification is involved.
 */
export async function runBangumiPreview(
  session: BangumiSettingsSession,
  signal: AbortSignal,
  commandId: BangumiCommandId,
  run: (handle: BangumiJobHandle) => Promise<BangumiJobSummary>
): Promise<readonly BangumiPreviewGroupDto[]> {
  await assertBangumiCommandIdle(commandId)
  const handle = createPreviewJobHandle(signal, (label) => session.pushPreviewProgress(label))
  const summary = await run(handle)
  return summary.previewGroups
}

/**
 * In-process job handle for previews: checkpoints honor the abort signal,
 * progress lands in the settings webview, and terminal states are no-ops
 * because the preview result returns to the caller directly.
 */
function createPreviewJobHandle(
  signal: AbortSignal,
  onProgress: (label: string) => void
): BangumiJobHandle {
  return {
    signal,
    async report(update: TaskRunProgressUpdate): Promise<void> {
      const label = formatPreviewProgress(update)
      if (label) {
        onProgress(label)
      }
    },
    async checkpoint(): Promise<void> {
      if (signal.aborted) {
        throw new TaskRunCancellation('Bangumi preview was cancelled.')
      }
    },
    async complete(_result?: PreviewResult): Promise<void> {},
    async fail(_error: unknown, _result?: PreviewResult): Promise<void> {},
    async cancel(_result?: PreviewResult): Promise<void> {}
  }
}

function formatPreviewProgress(update: TaskRunProgressUpdate): string | undefined {
  const base = update.phase?.label
  const current = update.work?.current
  const total = update.work?.total
  const count =
    current !== undefined && total !== undefined
      ? `(${current}/${total})`
      : current !== undefined
        ? `(${current})`
        : undefined
  return count ? [base, count].filter(Boolean).join(' ') : base
}
