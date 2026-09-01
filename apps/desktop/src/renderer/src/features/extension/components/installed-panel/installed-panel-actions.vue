<!--
Installed Panel Actions render the installed route's header operations: the
automatic update summary and the manual update check, both over the installed
extension store. Mounted only while the installed route is active.
-->
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/utils/cn'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'
import { useInstalledExtensionStore } from '../../stores'

const log = createLogger('Extension')

const { m } = useI18n()
const store = useInstalledExtensionStore()

onMounted(() => {
  void store.init()
})

const automaticUpdateRun = computed(() => store.automaticUpdateRun)

const automaticUpdateSummary = computed(() => {
  const run = automaticUpdateRun.value
  if (run.status === 'idle') {
    return null
  }

  if (run.status === 'running') {
    return m.value.extension.installed.startupUpdating
  }

  const updated = run.results.filter((result) => result.status === 'updated').length
  const failed = run.results.filter((result) => result.status === 'failed').length
  if (updated === 0 && failed === 0) {
    return run.repositoryRefreshError ? m.value.extension.installed.repositoryRefreshFailed : null
  }
  if (failed > 0) {
    return m.value.extension.installed.autoUpdateFailedCount({ count: failed })
  }

  return null
})

const automaticUpdateIcon = computed(() => {
  if (automaticUpdateRun.value.status === 'running') {
    return 'icon-[mdi--refresh]'
  }

  return automaticUpdateRun.value.results.some((result) => result.status === 'failed') ||
    automaticUpdateRun.value.repositoryRefreshError
    ? 'icon-[mdi--alert-circle-outline]'
    : 'icon-[mdi--check-circle-outline]'
})

async function handleCheckUpdates() {
  try {
    const result = await store.checkUpdates()
    if (result.updates.length > 0) {
      notify.info(
        m.value.extension.installed.updatesAvailable,
        m.value.extension.installed.updatesAvailableCount({ count: result.updates.length })
      )
    } else {
      notify.info(m.value.extension.installed.noUpdates)
    }
  } catch (error) {
    log.error('Failed to check updates:', error)
    notify.error(
      m.value.extension.installed.checkUpdatesFailed,
      error instanceof Error ? error.message : String(error)
    )
  }
}
</script>

<template>
  <div
    v-if="automaticUpdateSummary"
    class="flex items-center gap-1.5 text-xs text-muted-foreground"
  >
    <Icon
      :icon="automaticUpdateIcon"
      :class="
        cn(
          'size-3.5',
          automaticUpdateRun.status === 'running' && 'animate-spin',
          (automaticUpdateRun.results.some((result) => result.status === 'failed') ||
            automaticUpdateRun.repositoryRefreshError) &&
            'text-destructive'
        )
      "
    />
    <span>{{ automaticUpdateSummary }}</span>
  </div>

  <Button
    variant="outline"
    size="sm"
    :disabled="store.checkingUpdates"
    @click="handleCheckUpdates"
  >
    <Icon
      icon="icon-[mdi--refresh]"
      :class="cn('size-4', store.checkingUpdates && 'animate-spin')"
    />
    {{ m.extension.installed.checkUpdates }}
  </Button>
</template>
