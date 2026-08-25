import type { ScraperHooks } from '@main/services/scraper/hooks'
import type { ExtensionHookContributionPoint } from '../point'

/** Binds scraper module hooks to their public hook points. */
export function bindScraperHookPoints(
  scraper: ScraperHooks,
  point: ExtensionHookContributionPoint
): void {
  scraper.game.lookup.tap((value) => point.transform('scraper.game.lookup', value))
  scraper.game.searched.tap((value) => point.transform('scraper.game.searched', value))
  scraper.game.collected.tap((value) => point.transform('scraper.game.collected', value))
  scraper.anime.lookup.tap((value) => point.transform('scraper.anime.lookup', value))
  scraper.anime.searched.tap((value) => point.transform('scraper.anime.searched', value))
  scraper.anime.collected.tap((value) => point.transform('scraper.anime.collected', value))
  scraper.comic.lookup.tap((value) => point.transform('scraper.comic.lookup', value))
  scraper.comic.searched.tap((value) => point.transform('scraper.comic.searched', value))
  scraper.comic.collected.tap((value) => point.transform('scraper.comic.collected', value))
  scraper.novel.lookup.tap((value) => point.transform('scraper.novel.lookup', value))
  scraper.novel.searched.tap((value) => point.transform('scraper.novel.searched', value))
  scraper.novel.collected.tap((value) => point.transform('scraper.novel.collected', value))
  scraper.person.lookup.tap((value) => point.transform('scraper.person.lookup', value))
  scraper.person.searched.tap((value) => point.transform('scraper.person.searched', value))
  scraper.person.collected.tap((value) => point.transform('scraper.person.collected', value))
  scraper.company.lookup.tap((value) => point.transform('scraper.company.lookup', value))
  scraper.company.searched.tap((value) => point.transform('scraper.company.searched', value))
  scraper.company.collected.tap((value) => point.transform('scraper.company.collected', value))
  scraper.character.lookup.tap((value) => point.transform('scraper.character.lookup', value))
  scraper.character.searched.tap((value) => point.transform('scraper.character.searched', value))
  scraper.character.collected.tap((value) => point.transform('scraper.character.collected', value))
}
