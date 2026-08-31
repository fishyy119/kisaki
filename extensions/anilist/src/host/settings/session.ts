import type { ExtensionLogger, WebviewRpcRemote } from '@kisaki3/extension-sdk'
import type { AnilistSettingsUiFunctions } from '../../shared/settings'

/**
 * In-memory settings webview session: tracks the connected document and
 * pushes refresh signals into it. All pushes are no-ops while no document
 * is attached.
 */
export class AnilistSettingsSession {
  private remote: WebviewRpcRemote<AnilistSettingsUiFunctions> | null = null

  constructor(private readonly logger: ExtensionLogger) {}

  attach(remote: WebviewRpcRemote<AnilistSettingsUiFunctions>): void {
    this.remote = remote
  }

  detach(): void {
    this.remote = null
  }

  pushRefresh(reason: string): void {
    this.remote?.refreshRequested(reason).catch((error: unknown) => {
      this.logger.warn('AniList settings refresh push failed.', {
        reason,
        message: error instanceof Error ? error.message : String(error)
      })
    })
  }
}
