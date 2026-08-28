# MyAnimeList Extension

Built-in MyAnimeList integration for Kisaki.

- Scraper providers for anime, comics (manga), and novels (light novels),
  backed by the official MAL API v2 for core metadata, tags, covers, and
  related entries.
- Characters, staff, and episodes come from a configurable Jikan-compatible
  mirror (Tenrai by default); when the mirror is disabled or unreachable those
  slots are simply absent.
- List integration: sign in with the MAL account directly from the app
  (OAuth PKCE, no intermediary), import anime and manga lists into the
  library, and push local status and score changes back to MAL.
