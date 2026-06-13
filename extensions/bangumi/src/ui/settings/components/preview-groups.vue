<!--
Preview Groups renders job preview output as grouped badge and before/after
row lists.
Boundary: purely presentational over `BangumiPreviewGroupDto` data.
-->
<script setup lang="ts">
import { Alert, Badge, type BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { BangumiJobPreviewTone, BangumiPreviewGroupDto } from '../../../shared/settings'

interface Props {
  groups: readonly BangumiPreviewGroupDto[]
}

defineProps<Props>()

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
</script>

<template>
  <Alert v-if="groups.length === 0">没有将要更改的条目</Alert>
  <div
    v-else
    class="flex max-h-[260px] flex-col gap-2 overflow-y-auto"
  >
    <article
      v-for="group in groups"
      :key="group.id"
      class="rounded-md border border-border px-2.5 py-2"
    >
      <header class="flex items-center gap-2 text-xs">
        <span class="font-medium">{{ group.title }}</span>
        <Badge
          v-for="badge in group.badges"
          :key="badge.label"
          :variant="BADGE_VARIANTS[badge.tone]"
        >
          {{ badge.label }}
        </Badge>
        <a
          :href="group.link.href"
          target="_blank"
          rel="noreferrer"
          class="ml-auto text-[11px] text-primary hover:underline"
        >
          {{ group.link.label }}
        </a>
      </header>
      <table
        v-if="group.rows.length > 0"
        class="mt-1.5 w-full border-collapse text-xs"
      >
        <tbody>
          <tr
            v-for="(row, index) in group.rows"
            :key="index"
          >
            <td
              class="py-0.5 pr-1.5 align-top whitespace-nowrap"
              :class="rowCellClass(row.tone, true)"
            >
              {{ row.label }}
            </td>
            <td
              class="py-0.5 pr-1.5 align-top line-through"
              :class="rowCellClass(row.tone, true)"
            >
              {{ row.before }}
            </td>
            <td
              class="py-0.5 pr-1.5 align-top"
              :class="rowCellClass(row.tone, true)"
            >
              →
            </td>
            <td
              class="py-0.5 align-top"
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
