# Bangumi

Built-in Bangumi integration for Kisaki.

## Scope

The extension supports four Bangumi media scopes:

- `book` (`SubjectType=1`): remote collection and index preview.
- `game` (`SubjectType=4`): game scraper, local sync, collection import, index import, and recommended background tasks.
- `anime` (`SubjectType=2`): remote collection and index preview.
- `music` (`SubjectType=3`): remote collection and index preview.

Kisaki currently exposes only a local game library adapter. Book, anime, and music flows never write to the local game library.

## Settings

The settings panel is titled "Bangumi 集成" and uses Account, Sync, Import, Automation, and Advanced tabs.

- Account manages login, account verification, credential refresh, and logout without scope selection.
- Sync exposes local synchronization only for the local-capable game scope.
- Import dialogs include a four-scope media selector. Game can write to the local library; book, anime, and music are disabled in the settings UI until local adapters exist.
- Automation creates recommended Bangumi jobs through Kisaki background tasks and does not run, cancel, or display task history inside the extension settings panel.
- Advanced keeps low-level settings and cleanup actions together, including clearing credentials, clearing sync state, and restoring default settings.
