/**
 * Reader-window preload.
 *
 * Reader windows lay out book files the user obtained elsewhere, so they get
 * the narrowest bridge that still runs the window: its own reader channels
 * plus the locale and theme state every window mirrors. Nothing here reaches
 * the library, the filesystem, or the extension host.
 */

import { exposeIpcBridge, type IpcChannelPolicy } from './bridge'

const READER_CHANNEL_POLICY: IpcChannelPolicy = {
  invoke: [
    'reader:bootstrap',
    'reader:comic-progress',
    'reader:novel-progress',
    'reader:unit-opened',
    'reader:close',
    'i18n:get-state',
    'extension:get-theme-contributions'
  ],
  send: ['app:theme-changed'],
  receive: ['reader:navigate', 'i18n:state-changed', 'extension:contributions-changed']
}

exposeIpcBridge(READER_CHANNEL_POLICY)
