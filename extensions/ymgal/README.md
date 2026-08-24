# YMGal (built-in)

Scrapes visual novel metadata from [月幕Galgame](https://www.ymgal.games) (YMGal) into the Kisaki
library. Ships with the desktop app as a built-in extension.

## Providers

| Media type | Search | Slots                                                          | Notes                            |
| ---------- | ------ | -------------------------------------------------------------- | -------------------------------- |
| game       | yes    | `info`, `tags`, `characters`, `persons`, `companies`, `covers` | Entry provider for visual novels |
| company    | no     | `info`, `tags`, `logos`                                        | Resolved by known YMGal id only  |
| person     | no     | `info`, `tags`, `photos`                                       | Resolved by known YMGal id only  |
| character  | no     | `info`, `tags`, `persons`, `photos`                            | Resolved by known YMGal id only  |

The satellite providers declare no `search` capability: the public YMGal API exposes keyword search
for games only, and organizations, persons, and characters are addressable by archive id. In
practice those ids arrive with the entry scrape, so the satellite providers enrich entities the game
provider already identified.

## Credentials

YMGal publishes a shared public client for open API access, and the extension uses it by default —
no setup required. Enter your own `client_id` / `client_secret` in the extension settings if you
applied for a dedicated one; a dedicated client gets its own rate-limit pool.

## Development

```bash
pnpm --filter @kisaki3/builtin-ymgal build
pnpm --filter @kisaki3/builtin-ymgal check
```
