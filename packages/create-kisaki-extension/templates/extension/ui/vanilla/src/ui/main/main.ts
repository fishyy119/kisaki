import { createWebviewRpc, webview } from '@kisaki3/extension-sdk/webview'
import type { HostFunctions } from '../../shared/contract'
import './style.css'

const host = createWebviewRpc<HostFunctions>(webview)

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('Missing #app container.')
}

app.innerHTML = `
  <main class="flex min-h-screen flex-col gap-4 bg-background p-5 text-sm text-foreground">
    <p class="text-muted-foreground">
      This document runs inside a Kisaki webview with full Vite HMR in development.
    </p>
    <label class="flex items-center gap-2">
      <input id="enabled" type="checkbox" class="accent-primary" />
      Enabled
    </label>
    <div class="flex gap-2">
      <button
        id="notify"
        type="button"
        class="cursor-pointer rounded-md border border-border bg-surface px-3.5 py-1.5 text-surface-foreground hover:border-primary"
      >
        Test notification
      </button>
      <button
        id="save"
        type="button"
        class="cursor-pointer rounded-md bg-primary px-3.5 py-1.5 text-primary-foreground"
      >
        Save and close
      </button>
    </div>
  </main>
`

const enabledInput = app.querySelector<HTMLInputElement>('#enabled')!
const notifyButton = app.querySelector<HTMLButtonElement>('#notify')!
const saveButton = app.querySelector<HTMLButtonElement>('#save')!

void host.loadState().then((state) => {
  enabledInput.checked = state.enabled
})

notifyButton.addEventListener('click', () => {
  void host.sendTestNotification()
})

saveButton.addEventListener('click', () => {
  void host.saveState({ enabled: enabledInput.checked }).then(() => {
    webview.close()
  })
})
