import { watch } from 'vue'
import { router } from '@renderer/core/router'
import { extensionWebviewStore } from './webviews'

let initialized = false

/**
 * Binds page-surface webview sessions to the router: the newest opened page
 * session navigates to `/extension-webview/:webviewId`, and the page is left
 * again when its session closes.
 */
export function setupExtensionWebviewNavigation(): void {
  if (initialized) {
    return
  }
  initialized = true

  let knownPageIds = new Set<string>()

  watch(extensionWebviewStore.pageSessions, (pageSessions) => {
    const openedPage = pageSessions.findLast((session) => !knownPageIds.has(session.webviewId))
    knownPageIds = new Set(pageSessions.map((session) => session.webviewId))

    if (openedPage) {
      void router.push({
        name: 'extension-webview',
        params: { webviewId: openedPage.webviewId }
      })
      return
    }

    const route = router.currentRoute.value
    if (route.name !== 'extension-webview') {
      return
    }

    const stillOpen = pageSessions.some((session) => session.webviewId === route.params.webviewId)
    if (!stillOpen) {
      leaveExtensionWebviewPage()
    }
  })
}

/**
 * Leaves the webview page surface: back when the router recorded a previous
 * entry, otherwise to the library as the neutral landing page.
 */
function leaveExtensionWebviewPage(): void {
  if (router.options.history.state.back != null) {
    router.back()
  } else {
    void router.replace('/library')
  }
}
