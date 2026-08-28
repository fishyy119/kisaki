# NeoDB Extension

Built-in NeoDB integration for Kisaki.

- Novel scraper provider backed by the NeoDB catalog (any instance;
  `neodb.social` by default): Chinese-first bibliographic data with localized
  titles, author and publisher credits, tags, and covers. Entries hand over
  Douban, Bangumi, Goodreads, OpenLibrary, and ISBN identifiers when the
  catalog states them.
- Reading integration: sign in with Mastodon-style dynamic client
  registration (the app registers itself on the chosen instance; per-user
  credentials stay in the local secret store), import shelf statuses and
  ratings, and push local status and score changes back. A manual-code path
  covers instances where the browser cannot bounce back to the app.
