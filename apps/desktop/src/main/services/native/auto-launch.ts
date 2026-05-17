import { app } from 'electron'

export class NativeAutoLaunch {
  getEnabled(): boolean {
    return !!app.getLoginItemSettings().openAtLogin
  }

  setEnabled(enabled: boolean): void {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: []
    })
  }
}
