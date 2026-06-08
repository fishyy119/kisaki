<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@renderer/components/ui/badge'
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import { cn } from '@renderer/utils'
import type { ExtensionResolvedSettingsPanelComparisonListNode } from '@shared/extension'

type ComparisonTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelComparisonListNode
}>()

const visibleSummary = computed(() => props.node.summary?.filter((item) => item.value) ?? [])

function getBadgeVariant(
  tone?: ComparisonTone
): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline' {
  switch (tone) {
    case 'info':
      return 'default'
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'danger':
      return 'destructive'
    case 'neutral':
    default:
      return 'outline'
  }
}

function getRowAfterClass(tone?: ComparisonTone): string {
  return cn(
    'min-w-0 truncate font-medium text-foreground',
    tone === 'info' && 'text-primary',
    tone === 'success' && 'text-success',
    tone === 'warning' && 'text-warning',
    tone === 'danger' && 'text-destructive'
  )
}

async function openLink(href: string): Promise<void> {
  try {
    unwrapIpcVoid(await ipcManager.invoke('native:open-external', href))
  } catch (error) {
    notify.error('打开链接失败', error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <div class="w-full space-y-1.5">
    <div
      v-if="props.node.title || visibleSummary.length > 0"
      class="flex flex-wrap items-center justify-between gap-1.5"
    >
      <div
        v-if="props.node.title"
        class="text-xs font-medium leading-5"
      >
        {{ props.node.title }}
      </div>
      <div
        v-if="visibleSummary.length > 0"
        class="flex min-w-0 flex-wrap items-center gap-1"
      >
        <Badge
          v-for="item in visibleSummary"
          :key="item.label"
          class="h-5"
          :variant="getBadgeVariant(item.tone)"
        >
          <span class="text-muted-foreground">{{ item.label }}</span>
          <span>{{ item.value }}</span>
        </Badge>
      </div>
    </div>

    <div
      v-if="props.node.groups.length > 0"
      class="overflow-hidden rounded-md border border-border"
    >
      <div
        v-for="(group, groupIndex) in props.node.groups"
        :key="group.id"
        class="border-border"
        :class="groupIndex > 0 && 'border-t'"
      >
        <div class="flex min-w-0 flex-wrap items-center gap-1.5 bg-muted/25 px-2.5 py-1.5">
          <div class="min-w-0 flex-1">
            <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <span
                class="min-w-0 truncate text-xs font-medium leading-5 text-foreground"
                :title="group.title"
              >
                {{ group.title }}
              </span>
              <button
                v-if="group.link"
                type="button"
                class="inline-flex min-w-0 max-w-full items-center text-left text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                @click="openLink(group.link.href)"
              >
                <span
                  class="truncate"
                  :title="group.link.label"
                >
                  {{ group.link.label }}
                </span>
              </button>
              <span
                v-if="group.subtitle"
                class="min-w-0 truncate text-xs text-muted-foreground"
                :title="group.subtitle"
              >
                {{ group.subtitle }}
              </span>
            </div>
          </div>
          <div
            v-if="group.badges?.length"
            class="flex min-w-0 flex-wrap items-center gap-1"
          >
            <Badge
              v-for="badge in group.badges"
              :key="badge.label"
              class="h-5"
              :variant="getBadgeVariant(badge.tone)"
            >
              {{ badge.label }}
            </Badge>
          </div>
        </div>

        <div class="divide-y divide-border/80">
          <div
            v-for="(row, rowIndex) in group.rows"
            :key="`${row.label}:${rowIndex}`"
            class="grid min-w-0 grid-cols-[minmax(4.75rem,0.72fr)_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 px-2.5 py-1 text-xs leading-5"
          >
            <div
              class="min-w-0 truncate text-muted-foreground"
              :title="row.label"
            >
              {{ row.label }}
            </div>
            <div
              class="min-w-0 truncate text-muted-foreground"
              :title="row.before"
            >
              {{ row.before }}
            </div>
            <div class="text-xs text-muted-foreground">-&gt;</div>
            <div
              :class="getRowAfterClass(row.tone)"
              :title="row.after"
            >
              {{ row.after }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <p
      v-else-if="props.node.emptyLabel"
      class="text-sm text-muted-foreground"
    >
      {{ props.node.emptyLabel }}
    </p>
  </div>
</template>
