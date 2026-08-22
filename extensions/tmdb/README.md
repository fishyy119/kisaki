# TMDB

Built-in The Movie Database scraper for Kisaki, with native support for TMDB episode groups.

## Providers

- `anime`: search, info, tags, episodes, persons, companies, related entries, covers, backdrops, and logos.
- `person`: search, info, and photos.
- `company`: search, info, tags, and logos.

TMDB has no character entity, so this provider contributes no characters and no cast: it can state that a
person is credited in an entry, never which character they voice there. Pair it with a character-capable
provider in a mixed scraper profile to get both.

The info slot reports TMDB's alternative titles as entry aliases, so a show found by its romanization or a
regional release name matches in search. TMDB titles a show rather than a season, so a season or episode-group
entry takes the show's other titles, exactly as it already takes the show's original name.

## Entry identity

An anime entry is one flat episode list, while TMDB models a show as a series with seasons plus any number of
alternate episode groups. Its TMDB external id therefore names which slice of TMDB the entry mirrors:

- `movie:{movieId}` — one film.
- `tv:{seriesId}:s{seasonNumber}` — one season, and `s0` is the specials season.
- `tv:{seriesId}:eg:{episodeGroupId}:{groupId}` — one group of an episode group, both named by their own TMDB
  id, so adding or reordering a group never repoints an entry.
- `tv:{seriesId}` — the whole show, seasons flattened into one absolute run. An entry is one season, so this
  slice is never offered as a search row; it stays resolvable for a hand-written id.

Every scraped episode carries its TMDB episode id, which is the same id in every ordering. Switching an entry
between aired seasons and an episode group is therefore a re-scrape: rows realign by id, only the numbering
changes, and watch state survives.

## Search

Every row is one entry's worth of TMDB: a film, a season, or one part of an episode group.

- A name searches both `/search/tv` and `/search/movie`, and expands the most popular series into per-season
  rows.
- A pasted id or themoviedb.org link is read before a name search happens, so a page found on the site can be
  pasted as found. It enumerates every season and every part of every episode group that show has, so binding
  an entry to an episode group never requires leaving the app.
- A bare number is read as a show id.

## Settings

TMDB requires a personal key. The settings dialog stores it in the extension secret store and accepts both a v3
API key and a v4 read access token, telling them apart by shape. The dialog also exposes a connection test, the
API and image base URLs (for mirrors), adult results, the request timeout, and the retry count.
