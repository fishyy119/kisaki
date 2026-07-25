<!-- Renders Bangumi job preview groups and opens external links through the host. -->
<script setup lang="ts">
import { Alert, Badge, type BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { BangumiJobPreviewTone, BangumiPreviewGroupDto } from '../../../shared/settings'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

interface Props {
  groups: readonly BangumiPreviewGroupDto[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  error: [message: string]
}>()

const BADGE_VARIANTS: Record<BangumiJobPreviewTone, BadgeVariants['variant']> = {
  neutral: 'secondary',
  info: 'default',
  success: 'success',
  warning: 'warning',
  danger: 'destructive'
}

function rowCellClass(tone: BangumiJobPreviewTone, mutedByDefault: boolean): string {
  if (tone === 'danger') {
    return 'text-destructive'
  }

  return mutedByDefault ? 'text-muted-foreground' : ''
}

function openExternalLink(url: string): void {
  void host.openExternal(url).catch((error) => {
    emit('error', toErrorMessage(error))
  })
}
</script>

<template>
  <Alert v-if="props.groups.length === 0">{{ m.ui.previewDialog.empty }}</Alert>
  <div
    v-else
    class="rounded-md border border-border"
  >
    <article
      v-for="group in props.groups"
      :key="group.id"
      class="border-b border-border px-3 py-2 last:border-b-0"
    >
      <header class="flex min-w-0 items-center gap-2 text-xs">
        <span class="min-w-0 truncate font-medium">{{ group.title }}</span>
        <Badge
          v-for="badge in group.badges"
          :key="badge.label"
          :variant="BADGE_VARIANTS[badge.tone]"
        >
          {{ badge.label }}
        </Badge>
        <a
          :href="group.link.href"
          class="ml-auto shrink-0 rounded-sm text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          @click.prevent="openExternalLink(group.link.href)"
        >
          {{ group.link.label }}
        </a>
      </header>
      <table
        v-if="group.rows.length > 0"
        class="mt-1.5 w-full table-fixed border-collapse text-xs"
      >
        <tbody>
          <tr
            v-for="(row, index) in group.rows"
            :key="index"
          >
            <td
              class="w-24 py-0.5 pr-2 align-top whitespace-nowrap"
              :class="rowCellClass(row.tone, true)"
            >
              {{ row.label }}
            </td>
            <td
              class="w-[34%] truncate py-0.5 pr-2 align-top line-through"
              :class="rowCellClass(row.tone, true)"
            >
              {{ row.before }}
            </td>
            <td
              class="w-5 py-0.5 pr-2 align-top"
              :class="rowCellClass(row.tone, true)"
            >
              →
            </td>
            <td
              class="truncate py-0.5 align-top"
              :class="rowCellClass(row.tone, false)"
            >
              {{ row.after }}
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  </div>
</template>
