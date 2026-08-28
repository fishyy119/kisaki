# AniList Extension

Built-in AniList integration for Kisaki.

- Scraper providers for anime, comics (manga), and novels (light novels), plus
  person (staff) and character enrichment, backed by the public GraphQL API.
- List integration: sign in through the Kisaki OAuth relay, import your anime
  and manga lists into the library, and push local status and score changes
  back to AniList.

AniList issues no refresh tokens; an access token stays valid for about a
year, after which signing in again is required.
