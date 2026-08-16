# TMDB

Built-in The Movie Database scraper for Kisaki, with native support for TMDB episode groups.

## Providers

- `anime`: search, info, tags, episodes, persons, companies, related entries, covers, backdrops, and logos.
- `tv`: search, info, tags, seasons, episodes, persons, companies, covers, backdrops, and logos.
- `movie`: search, info, tags, persons, companies, related entries, covers, backdrops, and logos.
- `person`: search, info, and photos.
- `company`: search, info, tags, and logos.

TMDB has no character entity, so no media provider here contributes characters; pair one with a
character-capable provider in a mixed scraper profile. The tv provider also contributes no related entries:
TMDB never states a relation between two shows, and the seasons of one show are part of the entry rather than
neighbours of it.

## Entry identity

A tv entry is a whole TMDB show — `tv:{seriesId}` — and a movie entry one TMDB film — `movie:{movieId}`.
Seasons and episode groups are ways of slicing a show, and a tv entry already owns its seasons, so they never
name a tv entry; a link to one still resolves to the show it belongs to.

An anime entry is different: it is one flat episode list, while TMDB models a show as a series with seasons
plus any number of alternate episode groups. Its TMDB external id therefore names which slice of TMDB the
entry mirrors:

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

Every row is one entry's worth of TMDB, which is what the media type says it is: one show for `tv`, one film
for `movie`, and for `anime` a film, a season, or one part of an episode group.

- A name searches the endpoint the media type belongs to; `anime` searches both `/search/tv` and
  `/search/movie`, and expands the most popular series into per-season rows.
- A pasted id or themoviedb.org link is read before a name search happens, so a page found on the site can be
  pasted as found. For `anime` it enumerates every season and every part of every episode group that show has,
  so binding an entry to an episode group never requires leaving the app.
- A bare number is read as the media type's own kind: a show for `tv` and `anime`, a film for `movie`.

## Settings

TMDB requires a personal key. The settings dialog stores it in the extension secret store and accepts both a v3
API key and a v4 read access token, telling them apart by shape. The dialog also exposes a connection test, the
API and image base URLs (for mirrors), adult results, the request timeout, and the retry count.
