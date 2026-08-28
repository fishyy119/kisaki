# Steam Extension

Built-in Steam integration for Kisaki.

- Game scraper provider backed by the Steam store API: localized names and
  descriptions, genre and category tags, developer and publisher credits, DLC
  relations, library capsule covers, and hero/screenshot backdrops. Store
  responses are cached because Steam rate-limits this API aggressively.
- Owned-games import: with a personal Web API key and SteamID, the owned
  library is read through `GetOwnedGames` and missing entries are created
  through a scraper profile.
