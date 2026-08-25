import type { KisakiPreloadBridge } from './bridge'

declare global {
  interface Window {
    kisaki: KisakiPreloadBridge
  }
}
