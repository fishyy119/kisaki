<!-- Overview Tab summarizes integration health and routes users to focused tabs. -->
<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button, Icon, SettingsSection, type BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { AnilistSettingsOverview } from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'
import { AUTOMATION_STATUS_VARIANTS, getAutomationLabel, getAutomationStatusLabel } from '../labels'

type SettingsTabId = 'account' | 'sync' | 'import' | 'automation' | 'maintenance'

/** Warn this many ms before the roughly year-long token expires. */
const EXPIRY_WARNING_MS = 14 * 86_400_000

interface Props {
  overview: AnilistSettingsOverview
}

const props = defineProps<Props>()

const emit = defineEmits<{
  navigate: [tab: SettingsTabId]
}>()

const accountLabel = computed(() =>
  props.overview.account.configured ? m.value.ui.overview.signedIn : m.value.ui.overview.notSignedIn
)

const accountBadge = computed<{ label: string; variant: BadgeVariants['variant'] }>(() => {
  const account = props.overview.account
  if (!account.configured) {
    return { label: m.value.ui.overview.notSignedIn, variant: 'secondary' }
  }
  if (account.expiresAt !== undefined && account.expiresAt <= Date.now()) {
    return { label: m.value.ui.overview.expired, variant: 'destructive' }
  }
  if (account.expiresAt !== undefined && account.expiresAt <= Date.now() + EXPIRY_WARNING_MS) {
    return { label: m.value.ui.overview.expiresSoon, variant: 'warning' }
  }
  return { label: m.value.ui.overview.available, variant: 'success' }
})

const syncItemsLabel = computed(() => {
  if (!settingsForm.syncEnabled) {
    return m.value.ui.overview.disabled
  }
  return settingsForm.syncPushScore
    ? m.value.ui.overview.withScore
    : m.value.ui.overview.withoutScore
})

const runningJobs = computed(() => props.overview.runningOperations.length)

const missingAutomationCount = computed(
  () => props.overview.automations.filter((automation) => automation.status === 'missing').length
)
</script>

<template>
  <div class="space-y-4">
    <SettingsSection :title="m.ui.overview.statusTitle">
      <div class="overflow-hidden rounded-md border border-border">
        <div class="grid -m-px lg:grid-cols-3">
          <button
            type="button"
            class="border-r border-b border-border px-3 py-2 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            @click="emit('navigate', 'account')"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <span class="text-xs text-muted-foreground">{{ m.ui.overview.accountLabel }}</span>
                <div class="mt-1 truncate text-sm font-medium">{{ accountLabel }}</div>
              </div>
              <Badge :variant="accountBadge.variant">{{ accountBadge.label }}</Badge>
            </div>
          </button>

          <button
            type="button"
            class="border-r border-b border-border px-3 py-2 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            @click="emit('navigate', 'sync')"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-muted-foreground">{{ m.ui.overview.autoSyncLabel }}</span>
              <Badge :variant="settingsForm.syncEnabled ? 'success' : 'secondary'">
                {{ settingsForm.syncEnabled ? m.ui.overview.enabled : m.ui.overview.disabled }}
              </Badge>
            </div>
            <div class="mt-1 truncate text-sm font-medium">{{ syncItemsLabel }}</div>
          </button>

          <button
            type="button"
            class="border-r border-b border-border px-3 py-2 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            @click="emit('navigate', 'automation')"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-muted-foreground">
                {{ m.ui.overview.recommendedAutomations }}
              </span>
              <Badge :variant="missingAutomationCount === 0 ? 'success' : 'warning'">
                {{
                  missingAutomationCount === 0
                    ? m.ui.overview.automationsComplete
                    : m.ui.overview.automationsMissing({ count: missingAutomationCount })
                }}
              </Badge>
            </div>
            <div class="mt-1 truncate text-sm font-medium">
              {{ m.ui.overview.templatesCount({ count: props.overview.automations.length }) }}
            </div>
          </button>
        </div>
      </div>
    </SettingsSection>

    <SettingsSection :title="m.ui.overview.runtimeTitle">
      <div class="overflow-hidden rounded-md border border-border">
        <div class="px-3 py-2">
          <div class="text-xs text-muted-foreground">{{ m.ui.overview.runningJobs }}</div>
          <div class="mt-1 flex items-center gap-2">
            <span class="text-lg leading-tight font-semibold">{{ runningJobs }}</span>
            <Badge :variant="runningJobs > 0 ? 'warning' : 'secondary'">
              {{ runningJobs > 0 ? m.ui.overview.running : m.ui.overview.idle }}
            </Badge>
          </div>
        </div>
      </div>
    </SettingsSection>

    <SettingsSection :title="m.ui.overview.quickActionsTitle">
      <div class="grid gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          class="justify-start"
          @click="emit('navigate', 'import')"
        >
          <Icon
            icon="icon-[mdi--database-import-outline]"
            class="size-3.5"
          />
          {{ m.ui.overview.importAction }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          class="justify-start"
          @click="emit('navigate', 'maintenance')"
        >
          <Icon
            icon="icon-[mdi--tune-variant]"
            class="size-3.5"
          />
          {{ m.ui.overview.maintenanceAction }}
        </Button>
      </div>
    </SettingsSection>

    <SettingsSection :title="m.ui.overview.automationsTitle">
      <div class="divide-y divide-border rounded-md border border-border">
        <div
          v-for="automation in props.overview.automations"
          :key="automation.kind"
          class="flex items-center justify-between gap-3 px-3 py-2"
        >
          <span class="min-w-0 truncate text-sm">{{ getAutomationLabel(automation.kind) }}</span>
          <Badge :variant="AUTOMATION_STATUS_VARIANTS[automation.status]">
            {{ getAutomationStatusLabel(automation.status) }}
          </Badge>
        </div>
      </div>
    </SettingsSection>
  </div>
</template>
