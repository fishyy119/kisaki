/**
 * Deeplink destinations.
 *
 * The renderer half of `kisaki://open/<destination>`: the curated external
 * vocabulary of navigable places. Every entry is a deliberate API decision —
 * destination names are user vocabulary that stays stable across internal
 * route refactors, and raw route paths are never exposed. Unknown
 * destinations are this module's feedback to own, because only the renderer
 * knows the vocabulary.
 */

import type { Router } from 'vue-router'
import { isAllEntityType } from '@shared/common'
import { compileDeeplinkRoutePattern, matchDeeplinkRoutePattern } from '@shared/deeplink'
import { getEntityDetailPath, LIBRARY_HOME_PATH } from '@renderer/utils/entity-routes'
import { ipcManager } from './ipc'
import { notify } from './notify'
import { messages } from './i18n'
import { createLogger } from './log'

const log = createLogger('Deeplink')

type DestinationResolver = (params: Record<string, string>) => string | null

/**
 * Destination vocabulary → internal route location. Entity destinations
 * derive from the shared entity-type enum, so new entity types join without
 * deeplink work; every other entry is added one deliberate line at a time.
 */
const DESTINATIONS: Record<string, DestinationResolver> = {
  '/': () => LIBRARY_HOME_PATH,
  '/:entityType/:id': ({ entityType, id }) =>
    entityType && id && isAllEntityType(entityType) ? getEntityDetailPath(entityType, id) : null,
  '/library': () => LIBRARY_HOME_PATH,
  '/statistics': () => '/statistics',
  '/scanner': () => '/scanner',
  '/automation': () => '/automation',
  '/extension': () => '/extension'
}

const compiledDestinations = Object.entries(DESTINATIONS)
  .map(([pattern, resolve]) => ({ compiled: compileDeeplinkRoutePattern(pattern), resolve }))
  .sort((left, right) => right.compiled.score - left.compiled.score)

function resolveDestination(path: string): string | null {
  for (const { compiled, resolve } of compiledDestinations) {
    const params = matchDeeplinkRoutePattern(compiled, path)
    if (params) {
      return resolve(params)
    }
  }
  return null
}

/**
 * Listens for `deeplink:open` events from the main process. Must run during
 * synchronous renderer init: the main process gates sends on document load,
 * and script execution precedes the load event.
 */
export function setupDeeplink(router: Router): void {
  ipcManager.on('deeplink:open', (_, { path }) => {
    const target = resolveDestination(path)
    if (!target) {
      log.warn('Unknown deeplink destination.', { destinationPath: path })
      notify.error(
        messages.value.deeplink.unknownDestinationTitle,
        messages.value.deeplink.unknownDestinationMessage
      )
      return
    }

    log.info('Opening deeplink destination.', { destinationPath: path, target })
    router.push(target).catch((error) => {
      log.warn('Destination navigation failed.', error)
    })
  })
}
