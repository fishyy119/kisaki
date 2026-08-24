# VNDB (built-in)

Scrapes visual novel metadata from the [Visual Novel Database](https://vndb.org) Kana API into the
Kisaki library. Ships with the desktop app as a built-in extension.

## Providers

| Media type | Search | Slots                                                                                         |
| ---------- | ------ | --------------------------------------------------------------------------------------------- |
| game       | yes    | `info`, `tags`, `characters`, `persons`, `companies`, `relatedEntries`, `covers`, `backdrops` |
| character  | yes    | `info`, `tags`, `photos`                                                                      |
| person     | yes    | `info`, `photos`                                                                              |
| company    | yes    | `info`, `tags`                                                                                |

VNDB models people as _staff_ and companies as _producers_; both are searchable, so all four
providers answer name queries as well as known-id lookups.

## Credentials

The Kana API is open, so the extension works with no setup. Add a personal API token in the
extension settings to raise your rate limit; tokens are created on your VNDB profile page.

## Development

```bash
pnpm --filter @kisaki3/builtin-vndb build
pnpm --filter @kisaki3/builtin-vndb check
```
