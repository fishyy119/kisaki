<script setup lang="ts">
import { ref, onErrorCaptured, type Ref } from 'vue'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const log = createLogger('App')

const { m } = useI18n()

const error: Ref<Error | null> = ref(null)
const errorInfo: Ref<string | null> = ref(null)

onErrorCaptured((err, _instance, info) => {
  error.value = err
  errorInfo.value = info
  log.error('ErrorBoundary caught an error:', err, info)
  return false
})

function resetError() {
  error.value = null
  errorInfo.value = null
}

function reloadApp() {
  window.location.reload()
}
</script>

<template>
  <div
    v-if="error"
    class="flex items-center justify-center h-screen bg-background"
  >
    <div class="max-w-2xl p-8 space-y-4">
      <div class="space-y-2">
        <h1 class="text-2xl font-bold text-destructive">{{ m.app.error.title }}</h1>
        <p class="text-muted-foreground">{{ m.app.error.description }}</p>
      </div>

      <div class="p-4 rounded-lg bg-muted space-y-2">
        <div>
          <h2 class="font-semibold text-sm mb-1">{{ m.app.error.messageLabel }}</h2>
          <pre class="text-xs overflow-auto">{{ error.message }}</pre>
        </div>

        <div v-if="error.stack">
          <h2 class="font-semibold text-sm mb-1">{{ m.app.error.stackLabel }}</h2>
          <pre class="text-xs overflow-auto max-h-60">{{ error.stack }}</pre>
        </div>
      </div>

      <div class="flex gap-2">
        <button
          class="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          @click="resetError"
        >
          {{ m.common.retry }}
        </button>
        <button
          class="px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
          @click="reloadApp"
        >
          {{ m.app.error.reload }}
        </button>
      </div>
    </div>
  </div>

  <slot v-else />
</template>
