import type { KisakiPreloadBridge } from './index'

declare global {
  interface Window {
    kisaki: KisakiPreloadBridge
  }
}

export {}
