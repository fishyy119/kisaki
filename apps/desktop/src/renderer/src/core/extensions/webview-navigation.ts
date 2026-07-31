import { watch } from 'vue'
import { router } from '@renderer/core/router'
import { extensionWebviewStore } from './webviews'

let initialized = false

/**
 * Binds page-surface webview sessions to the router: a newly opened page
 * session navigates to its stable `/extension-page/:extensionId/:pageId`
 * route, and the route is left when its page no longer has a live session.
 * Session replacement (openPage on an already-open page) keeps the route
 * because the new session belongs to the same declared page.
 */
export function setupExtensionWebviewNavigation(): void {
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
      if (!isCurrentPageRoute(openedSession.extensionId, openedSession.surface.pageId)) {
        void router.push({
          name: 'extension-page',
          params: {
            extensionId: openedSession.extensionId,
            pageId: openedSession.surface.pageId
          }
        })
      }
      return
    }

    const route = router.currentRoute.value
    if (route.name !== 'extension-page') {
      return
    }

    const stillOpen = pageSessions.some(
      (session) =>
        session.extensionId === route.params.extensionId &&
        session.surface.kind === 'page' &&
        session.surface.pageId === route.params.pageId
    )
    if (!stillOpen) {
      leaveExtensionPage()
    }
  })
}

function isCurrentPageRoute(extensionId: string, pageId: string): boolean {
  const route = router.currentRoute.value
  return (
    route.name === 'extension-page' &&
    route.params.extensionId === extensionId &&
    route.params.pageId === pageId
  )
}

/**
 * Leaves the extension page surface: back when the router recorded a previous
 * entry, otherwise to the library as the neutral landing page.
 */
function leaveExtensionPage(): void {
  if (router.options.history.state.back != null) {
    router.back()
  } else {
    void router.replace('/library')
  }
}
