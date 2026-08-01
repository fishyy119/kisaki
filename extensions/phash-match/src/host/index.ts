import path from 'node:path'
import { defineExtension } from '@kisaki3/extension-sdk'
import { GameEntryMatcher } from './matcher'
import { GAME_INDEX_FILE_NAME, PhashIndexStore } from './store'

export default defineExtension({
  activate(context) {
    const store = new PhashIndexStore({
      filePath: path.join(context.extension.dataPath, GAME_INDEX_FILE_NAME),
      logger: context.logger
    })
    const matcher = new GameEntryMatcher({ store, logger: context.logger })

    context.subscriptions.add(
      context.hooks.on('scanner.entry.matched', (value) => matcher.enrich(value))
    )
    context.subscriptions.add({ dispose: () => store.dispose() })

    context.logger.info('Built-in pHash match extension activated.')
  }
})
