/**
 * Reader-window preload.
 *
 * Reader windows lay out book files the user obtained elsewhere, so they get
 * the narrowest bridge that still runs the window: its own reader channels, the
 * reading marks made in it, and the locale, interface scale, and theme state
 * every window mirrors. Nothing here reaches the filesystem, the extension host, or the
 * library beyond the entry the window was opened for — the mark channels are
 * checked against that entry in the main process.
 */

import { exposeIpcBridge, type IpcChannelPolicy } from './bridge'

const READER_CHANNEL_POLICY: IpcChannelPolicy = {
  invoke: [
    'reader:bootstrap',
    'reader:progress',
    'reader:unit-opened',
    'reader:probe-pages',
    'reader:set-page-flow',
    'reader:set-fullscreen',
    'reader:close',
    'activity:list-novel-bookmarks',
    'activity:create-novel-bookmark',
    'activity:update-novel-bookmark',
    'activity:delete-novel-bookmark',
    'activity:list-novel-highlights',
    'activity:create-novel-highlight',
    'activity:update-novel-highlight',
    'activity:delete-novel-highlight',
    'activity:list-comic-bookmarks',
    'activity:toggle-comic-bookmark',
    'activity:update-comic-bookmark',
    'activity:delete-comic-bookmark',
    'i18n:get-state',
    'window:get-interface-scale',
    'extension:get-theme-contributions'
  ],
  send: ['app:theme-changed'],
  receive: [
    'reader:navigate',
    'reader:fullscreen-changed',
    'i18n:state-changed',
    'window:interface-scale-changed',
    'extension:contributions-changed'
  ]
}

exposeIpcBridge(READER_CHANNEL_POLICY)
