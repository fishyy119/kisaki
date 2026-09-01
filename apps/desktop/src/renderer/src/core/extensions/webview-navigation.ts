import { watch } from 'vue'
import type { Router } from 'vue-router'
import { LIBRARY_HOME_PATH } from '@renderer/utils/entity-routes'
import { extensionWebviewStore } from './webviews'

// Route contract of the extension declared page surface. The webview runtime
// owns this contract; the app entry mounts the record and links derive from it.
export const EXTENSION_PAGE_ROUTE_NAME = 'extension-page'
export const EXTENSION_PAGE_ROUTE_PATTERN = '/extension-page/:extensionId/:pageId'

/** Route of one extension declared page. */
export function getExtensionPagePath(extensionId: string, pageId: string): string {
  return `/extension-page/${extensionId}/${pageId}`
}

let initialized = false

/**
 * Binds page-surface webview sessions to the router: a newly opened page
 * session navigates to its stable `/extension-page/:extensionId/:pageId`
 * route, and the route is left when its page no longer has a live session.
 * Session replacement (openPage on an already-open page) keeps the route
 * because the new session belongs to the same declared page.
 *
 * The router is injected by the app entry so this module stays free of a
 * static dependency on the router singleton.
 */
export function setupExtensionWebviewNavigation(router: Router): void {
  if (initialized) {
    return
  }
  initialized = true

  let knownWebviewIds = new Set<string>()

  watch(extensionWebviewStore.pageSessions, (pageSessions) => {
    const openedSession = pageSessions.findLast(
      (session) => !knownWebviewIds.has(session.webviewId)
    )
    knownWebviewIds = new Set(pageSessions.map((session) => session.webviewId))

    if (openedSession && openedSession.surface.kind === 'page') {
      if (!isCurrentPageRoute(router, openedSession.extensionId, openedSession.surface.pageId)) {
        void router.push({
          name: EXTENSION_PAGE_ROUTE_NAME,
          params: {
            extensionId: openedSession.extensionId,
            pageId: openedSession.surface.pageId
          }
        })
      }
      return
    }

    const route = router.currentRoute.value
    if (route.name !== EXTENSION_PAGE_ROUTE_NAME) {
      return
    }

    const stillOpen = pageSessions.some(
      (session) =>
        session.extensionId === route.params.extensionId &&
        session.surface.kind === 'page' &&
        session.surface.pageId === route.params.pageId
    )
    if (!stillOpen) {
      leaveExtensionPage(router)
    }
  })
}

function isCurrentPageRoute(router: Router, extensionId: string, pageId: string): boolean {
  const route = router.currentRoute.value
  return (
    route.name === EXTENSION_PAGE_ROUTE_NAME &&
    route.params.extensionId === extensionId &&
    route.params.pageId === pageId
  )
}

/**
 * Leaves the extension page surface: back when the router recorded a previous
 * entry, otherwise to the library as the neutral landing page.
 */
function leaveExtensionPage(router: Router): void {
  if (router.options.history.state.back != null) {
    router.back()
  } else {
    void router.replace(LIBRARY_HOME_PATH)
  }
}
