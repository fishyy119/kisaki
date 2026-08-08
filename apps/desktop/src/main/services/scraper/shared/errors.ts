/**
 * Boundary errors for scraper providers.
 *
 * Provider failures surface in the renderer through `wrapIpc`, which forwards
 * `error.message` verbatim. Response bodies may contain tokens, echoed queries
 * or user content, so they are neither embedded in the message nor logged; the
 * message carries only the provider, the operation and the HTTP status.
 */

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
