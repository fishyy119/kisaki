/**
 * Host-side builder for the stable provider dependency contract.
 */

import {
  createIdResolvedTarget,
  findKnownId,
  normalizeScrapedDescription,
  parsePartialDate
} from './helpers'
import type { ScraperProviderDeps } from './types'

/**
 * Build the provider deps object injected into built-in scraper providers.
 */
export function createScraperProviderDeps(options: {
  network: ScraperProviderDeps['network']
  log: ScraperProviderDeps['log']
}): ScraperProviderDeps {
  return {
    network: options.network,
    log: options.log,
    helper: {
      lookup: {
        findKnownId
      },
      date: {
        parsePartialDate
      },
      text: {
        normalizeDescription: normalizeScrapedDescription
      },
      target: {
        createResolvedTarget: createIdResolvedTarget
      }
    }
  }
}
