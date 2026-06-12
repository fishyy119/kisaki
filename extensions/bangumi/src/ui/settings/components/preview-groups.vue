<script setup lang="ts">
import type { BangumiJobPreviewTone, BangumiPreviewGroupDto } from '../../../shared/settings'

interface Props {
  groups: readonly BangumiPreviewGroupDto[]
}

defineProps<Props>()

function badgeClass(tone: BangumiJobPreviewTone): string {
  if (tone === 'success') {
    return 'bg-accent/20 text-foreground'
  }

  if (tone === 'danger') {
    return 'bg-danger/15 text-danger'
  }

  return 'bg-muted text-muted-foreground'
}

function rowCellClass(tone: BangumiJobPreviewTone, mutedByDefault: boolean): string {
  if (tone === 'danger') {
    return 'text-danger'
  }

  return mutedByDefault ? 'text-muted-foreground' : ''
}
</script>

<template>
  <div
    v-if="groups.length === 0"
    class="notice"
  >
    没有将要更改的条目
  </div>
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
        <span class="font-semibold">{{ group.title }}</span>
        <span
          v-for="badge in group.badges"
          :key="badge.label"
          class="rounded-full px-1.5 py-px text-[11px]"
          :class="badgeClass(badge.tone)"
        >
          {{ badge.label }}
        </span>
        <a
          :href="group.link.href"
          target="_blank"
          rel="noreferrer"
          class="ml-auto text-[11px] text-primary"
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
