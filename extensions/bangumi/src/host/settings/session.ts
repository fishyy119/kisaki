import type { ExtensionLogger, WebviewRpcRemote } from '@kisaki3/extension-sdk'
import type { BangumiSettingsUiFunctions } from '../../shared/settings'

/**
 * In-memory settings webview session: tracks the connected document and
 * pushes refresh and preview-progress signals into it. All pushes are no-ops
 * while no document is attached.
 */
export class BangumiSettingsSession {
  private remote: WebviewRpcRemote<BangumiSettingsUiFunctions> | null = null

  constructor(private readonly logger: ExtensionLogger) {}

  attach(remote: WebviewRpcRemote<BangumiSettingsUiFunctions>): void {
    this.remote = remote
  }

  detach(): void {
    this.remote = null
  }

  pushRefresh(reason: string): void {
    this.remote?.refreshRequested(reason).catch((error: unknown) => {
      this.logger.warn('Bangumi settings refresh push failed.', {
        reason,
        message: error instanceof Error ? error.message : String(error)
      })
    })
  }

  pushPreviewProgress(label: string): void {
    this.remote?.previewProgress(label).catch(() => {
      // Progress pushes are cosmetic; a lost frame is irrelevant.
    })
  }
}
