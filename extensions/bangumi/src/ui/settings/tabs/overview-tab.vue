<!-- Overview Tab summarizes integration health and routes users to focused tabs. -->
<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button, Icon, type BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { BangumiSettingsOverview } from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'
import { AUTOMATION_STATUS_VARIANTS, getAutomationLabel, getAutomationStatusLabel } from '../labels'
import SettingsSection from '../components/settings-section.vue'

type SettingsTabId = 'account' | 'sync' | 'import' | 'automation' | 'maintenance'

interface Props {
  overview: BangumiSettingsOverview
}

const props = defineProps<Props>()

const emit = defineEmits<{
  navigate: [tab: SettingsTabId]
}>()

const accountLabel = computed(() => {
  if (!props.overview.account.loggedIn) {
    return m.value.ui.overview.notLoggedIn
  }

  return props.overview.account.nickname
    ? `${props.overview.account.nickname} (@${props.overview.account.username ?? '-'})`
    : m.value.ui.overview.loggedIn
})

const accountBadge = computed<{ label: string; variant: BadgeVariants['variant'] }>(() => {
  if (!props.overview.account.hasToken) {
    return { label: m.value.ui.overview.notAuthorized, variant: 'secondary' }
  }

  return props.overview.account.expired
    ? { label: m.value.ui.overview.credentialsExpired, variant: 'warning' }
    : { label: m.value.ui.overview.available, variant: 'success' }
})

const runningJobs = computed(() => Object.values(props.overview.activeJobs).filter(Boolean).length)

const profileCount = computed(() =>
  props.overview.scopes.reduce((total, scope) => total + scope.profiles.length, 0)
)

const missingAutomationCount = computed(
  () => props.overview.automations.filter((automation) => automation.status === 'missing').length
)

const syncItemsLabel = computed(() => {
  if (!settingsForm.autoSyncEnabled) {
    return m.value.ui.overview.disabled
  }

  const labels = [
    settingsForm.autoSyncItems.includes('create') ? m.value.ui.overview.syncItemCreate : null,
    settingsForm.autoSyncItems.includes('status') ? m.value.ui.overview.syncItemStatus : null,
    settingsForm.autoSyncItems.includes('score') ? m.value.ui.overview.syncItemScore : null
  ].filter(Boolean)

  return labels.length > 0
    ? labels.join(m.value.common.listSeparator)
    : m.value.ui.overview.noSyncItems
})
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
              <Badge :variant="settingsForm.autoSyncEnabled ? 'success' : 'secondary'">
                {{ settingsForm.autoSyncEnabled ? m.ui.overview.enabled : m.ui.overview.disabled }}
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
        <div class="grid -m-px sm:grid-cols-2">
          <div class="border-r border-b border-border px-3 py-2">
            <div class="text-xs text-muted-foreground">{{ m.ui.overview.runningJobs }}</div>
            <div class="mt-1 flex items-center gap-2">
              <span class="text-lg leading-tight font-semibold">{{ runningJobs }}</span>
              <Badge :variant="runningJobs > 0 ? 'warning' : 'secondary'">
                {{ runningJobs > 0 ? m.ui.overview.running : m.ui.overview.idle }}
              </Badge>
            </div>
          </div>
          <div class="border-r border-b border-border px-3 py-2">
            <div class="text-xs text-muted-foreground">{{ m.ui.overview.localResources }}</div>
            <div class="mt-1 text-sm">
              {{
                m.ui.overview.localResourcesSummary({
                  profiles: profileCount,
                  collections: props.overview.collections.length
                })
              }}
            </div>
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
