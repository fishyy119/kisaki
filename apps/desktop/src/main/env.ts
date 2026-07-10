import { app } from 'electron'

/** Runtime environment flags for the main process. */
export const isDev = !app.isPackaged

export const isWindows = process.platform === 'win32'
export const isMacOS = process.platform === 'darwin'
export const isLinux = process.platform === 'linux'

/** Renderer dev server origin injected by the bundler dev workflow; unset in production. */
export const rendererDevServerUrl = process.env['KISAKI_RENDERER_DEV_SERVER_URL']
