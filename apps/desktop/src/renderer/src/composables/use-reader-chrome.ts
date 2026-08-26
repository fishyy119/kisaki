/**
 * Reader chrome state: whether the window reads full screen, and which
 * navigation surface is docked beside the page.
 *
 * Full screen is the reader's chrome-free reading mode — the toolbar, panel,
 * and footer are not rendered at all rather than hidden, so no anchored popup
 * can have its trigger pulled out from under the pointer. The flag mirrors the
 * window's real state, which the main process pushes, because the platform can
 * enter or leave full screen without the reader asking.
 */

import { onBeforeUnmount, ref, type Ref } from 'vue'
import { onReaderFullScreenChanged, setReaderFullScreen } from '@renderer/core/reader/bridge'

/** Navigation panel pages; each reader offers the ones its engine can fill. */
export type ReaderPanelTab = 'outline' | 'pages' | 'marks' | 'search'

export interface ReaderChrome {
  fullScreen: Ref<boolean>
  panelOpen: Ref<boolean>
  panelTab: Ref<ReaderPanelTab>
  toggleFullScreen: () => void
  exitFullScreen: () => void
  togglePanel: () => void
  openPanel: (tab: ReaderPanelTab) => void
}

export function useReaderChrome(): ReaderChrome {
  const fullScreen = ref(false)
  const panelOpen = ref(false)
  const panelTab = ref<ReaderPanelTab>('outline')

  const stopFullScreenSync = onReaderFullScreenChanged((value) => {
    fullScreen.value = value
  })

  onBeforeUnmount(stopFullScreenSync)

  function toggleFullScreen(): void {
    setReaderFullScreen(!fullScreen.value)
  }

  function exitFullScreen(): void {
    setReaderFullScreen(false)
  }

  function togglePanel(): void {
    panelOpen.value = !panelOpen.value
  }

  function openPanel(tab: ReaderPanelTab): void {
    panelTab.value = tab
    panelOpen.value = true
  }

  return {
    fullScreen,
    panelOpen,
    panelTab,
    toggleFullScreen,
    exitFullScreen,
    togglePanel,
    openPanel
  }
}
