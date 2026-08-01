import type { ScannerHooks } from '@main/services/scanner/hooks'
import type { ExtensionHookContributionPoint } from '../point'

/** Binds scanner module hooks to their public hook points. */
export function bindScannerHookPoints(
  scanner: ScannerHooks,
  point: ExtensionHookContributionPoint
): void {
  scanner.entryDiscovered.tap((value) => point.transform('scanner.entry.discovered', value))
  scanner.entryMatched.tap((value) => point.transform('scanner.entry.matched', value))
  scanner.runStarted.tap((p) => point.notify('scanner.run.started', p))
  scanner.runFinished.tap((p) => point.notify('scanner.run.finished', p))
}
