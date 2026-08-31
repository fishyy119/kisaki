<!-- Automation Tab creates recommended app-owned automations for VNDB commands. -->
<script setup lang="ts">
import { ref } from 'vue'
import { Badge, Button, Icon, SettingsSection, Spinner } from '@kisaki3/extension-ui-vue'
import type { VndbAutomationKind, VndbSettingsOverview } from '../../../shared/settings'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'
import {
  AUTOMATION_STATUS_VARIANTS,
  getAutomationDescription,
  getAutomationLabel,
  getAutomationStatusLabel
} from '../labels'

interface Props {
  overview: VndbSettingsOverview
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const creatingKind = ref<VndbAutomationKind | null>(null)

async function create(kind: VndbAutomationKind): Promise<void> {
  creatingKind.value = kind
  try {
    await host.createAutomation(kind)
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    creatingKind.value = null
  }
}
</script>

<template>
  <SettingsSection
    :title="m.ui.automation.title"
    :description="m.ui.automation.description"
  >
    <div class="divide-y divide-border rounded-md border border-border">
      <div
        v-for="automation in props.overview.automations"
        :key="automation.kind"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2"
      >
        <div class="min-w-0">
          <div class="truncate text-sm font-medium">
            {{ getAutomationLabel(automation.kind) }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ getAutomationDescription(automation.kind) }}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Badge :variant="AUTOMATION_STATUS_VARIANTS[automation.status]">
            {{ getAutomationStatusLabel(automation.status) }}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            type="button"
            :disabled="automation.status !== 'missing' || creatingKind !== null"
            @click="create(automation.kind)"
          >
            <Spinner v-if="creatingKind === automation.kind" />
            <Icon
              v-else
              icon="icon-[mdi--plus]"
              class="size-3.5"
            />
            {{ m.ui.automation.create }}
          </Button>
        </div>
      </div>
    </div>
  </SettingsSection>
</template>
