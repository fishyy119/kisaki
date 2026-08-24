/**
 * Boundary errors for scraper providers.
 *
 * Provider failures surface in the renderer through `wrapIpc`, which forwards
 * `error.message` verbatim. Response bodies may contain tokens, echoed queries
 * or user content, so they are neither embedded in the message nor logged; the
 * message carries only the provider, the operation and the HTTP status.
 */

export type ScrapeFailureReason =
  'profile-unavailable' | 'provider-unavailable' | 'metadata-missing'

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

/**
 * Raised when a profile names a search provider that only resolves by id.
 *
 * Providers declare `search` as a capability, so a profile can point at one
 * that never answers name queries. That is a configuration problem the user
 * must see rather than an empty result list.
 */
export function createSearchUnsupportedError(providerId: string): ScrapeFailure {
  return new ScrapeFailure(
    'provider-unavailable',
    `Provider does not support search: ${providerId}`
  )
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
