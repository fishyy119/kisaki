/**
 * Boundary errors for scraper providers.
 *
 * Provider failures surface in the renderer through `wrapIpc`, which forwards
 * `error.message` verbatim. Response bodies may contain tokens, echoed queries
 * or user content, so they are neither embedded in the message nor logged; the
 * message carries only the provider, the operation and the HTTP status.
 */

export type ScrapeFailureReason = 'profile-unavailable' | 'provider-unavailable' | 'metadata-missing'

/**
 * Expected scrape-pipeline failure.
 *
 * Carries a typed reason so consumers such as scanner ingest classify by
 * `instanceof` and `reason` instead of matching message text. Anything else
 * escaping the pipeline is treated as a defect by those consumers.
 */
export class ScrapeFailure extends Error {
  constructor(
    readonly reason: ScrapeFailureReason,
    message: string
  ) {
    super(message)
    this.name = 'ScrapeFailure'
  }
}

export interface ProviderHttpFailure {
  status: number
  statusText: string
}

export function createProviderHttpError(
  provider: string,
  operation: string,
  response: ProviderHttpFailure
): Error {
  return new Error(
    `${provider} ${operation} failed: ${response.status} ${response.statusText || 'unknown status'}`
  )
}
