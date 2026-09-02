import { forEachScraperEntityHooks, type ScraperHooks } from '@main/services/scraper/hooks'
import type { ExtensionHookContributionPoint } from '../point'

/**
 * Binds scraper module hooks to their public hook points. The binding walks the
 * entity union, so every entity type exposes the same three edges and a new
 * type needs no binding work.
 */
export function bindScraperHookPoints(
  scraper: ScraperHooks,
  point: ExtensionHookContributionPoint
): void {
  forEachScraperEntityHooks(scraper, (entity, hooks) => {
    hooks.lookup.tap((value) => point.transform(`scraper.${entity}.lookup`, value))
    hooks.searched.tap((value) => point.transform(`scraper.${entity}.searched`, value))
    hooks.collected.tap((value) => point.transform(`scraper.${entity}.collected`, value))
  })
}
