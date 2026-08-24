# IGDB (built-in)

Scrapes video game metadata from the [Internet Game Database](https://www.igdb.com) into the Kisaki
library. Ships with the desktop app as a built-in extension.

## Providers

| Media type | Search | Slots                                                            |
| ---------- | ------ | ---------------------------------------------------------------- |
| game       | yes    | `info`, `tags`, `characters`, `companies`, `covers`, `backdrops` |
| company    | yes    | `info`, `logos`                                                  |

IGDB models characters without a per-game role or a voice cast, so game characters are contributed
without cast facts and there is no standalone character provider — the entity would carry nothing
the game scrape does not already provide.

## Credentials

IGDB authenticates through Twitch, so the extension needs a Twitch application's client id and
secret. Register one at [dev.twitch.tv](https://dev.twitch.tv/console/apps) and enter both in the
extension settings; until then the IGDB providers report that they are not configured and every
other provider in the profile continues normally.

## Development

```bash
pnpm --filter @kisaki3/builtin-igdb build
pnpm --filter @kisaki3/builtin-igdb check
```
