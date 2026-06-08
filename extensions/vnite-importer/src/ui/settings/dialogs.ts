import { createVniteDiagnosticsDialog } from './diagnostics-dialog'
import { createVniteFieldsDialog } from './fields-dialog'
import { VNITE_SETTINGS_DIALOG_IDS } from './ids'
import type { VniteSettingsRuntime } from './runtime'

export function createVniteSettingsDialogs(runtime: VniteSettingsRuntime) {
  return {
    [VNITE_SETTINGS_DIALOG_IDS.fields]: createVniteFieldsDialog(runtime),
    [VNITE_SETTINGS_DIALOG_IDS.diagnostics]: createVniteDiagnosticsDialog(runtime)
  }
}
