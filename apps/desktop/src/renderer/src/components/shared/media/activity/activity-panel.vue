<!--
  MediaActivityPanel
  Full activity surface for a media entry: stats, heatmap, trend and
  distribution charts followed by the recent sessions. The per-media session
  title is provided through the `session-title` slot.
-->
<script setup lang="ts" generic="TSession extends MediaSessionRow">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Section } from '@renderer/components/ui/section'
import { StateView } from '@renderer/components/ui/state-view'
import type { MediaType } from '@shared/entity-types'
import { useI18n } from '@renderer/composables/use-i18n'
import type { MediaSessionRow } from '../media-tables'
import MediaActivityStats from './activity-stats.vue'
import MediaActivityHeatmap from './activity-heatmap.vue'
import MediaActivityTrend from './activity-trend.vue'
import MediaActivityDistribution from './activity-distribution.vue'

/** Recent sessions only: the full history belongs to the statistics feature. */
const RECENT_SESSION_LIMIT = 20

interface Props {
  mediaType: MediaType
  sessions: TSession[]
}

const props = defineProps<Props>()

const { m, f } = useI18n()

const labels = computed(() => m.value[props.mediaType].activity)

const recentSessions = computed(() => props.sessions.slice(0, RECENT_SESSION_LIMIT))
</script>

<template>
  <!-- Empty -->
  <StateView
    v-if="props.sessions.length === 0"
    state="empty"
    icon="icon-[mdi--report-timeline-variant]"
    :title="labels.emptyTitle"
    :description="labels.emptyHint"
    class="py-12"
  />

  <!-- Content -->
  <div
    v-else
    class="space-y-6"
  >
    <!-- Stats Summary -->
    <Section :title="labels.statsOverview">
      <MediaActivityStats
        :media-type="props.mediaType"
        :sessions="props.sessions"
      />
    </Section>

    <!-- Activity Heatmap -->
    <Section :title="labels.heatmap">
      <div class="rounded-lg border p-4">
        <MediaActivityHeatmap :sessions="props.sessions" />
      </div>
    </Section>

    <!-- Trend & Distribution -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
      <!-- Time Trend -->
      <Section
        :title="labels.trend"
        class="flex h-full flex-col"
      >
        <div class="flex-1 rounded-lg border p-4">
          <MediaActivityTrend :sessions="props.sessions" />
        </div>
      </Section>

      <!-- Daily Distribution -->
      <Section
        :title="labels.distribution"
        class="flex h-full flex-col"
      >
        <div class="flex-1 rounded-lg border p-4">
          <MediaActivityDistribution
            :media-type="props.mediaType"
            :sessions="props.sessions"
          />
        </div>
      </Section>
    </div>

    <!-- Recent Sessions -->
    <Section :title="labels.recentSessions">
      <div class="rounded-md border divide-y overflow-hidden">
        <div
          v-for="session in recentSessions"
          :key="session.id"
          class="flex items-center justify-between gap-3 px-3 py-2.5"
        >
          <div class="flex items-center gap-3 min-w-0">
            <Icon
              icon="icon-[mdi--play-circle-outline]"
              class="size-4 text-muted-foreground shrink-0"
            />
            <div class="min-w-0">
              <p class="text-sm font-medium truncate">
                <slot
                  name="session-title"
                  :session="session"
                >
                  {{ f.date(session.startedAt) }}
                </slot>
              </p>
              <p class="text-xs text-muted-foreground">
                {{ f.dateTimeRange(session.startedAt, session.endedAt) }}
              </p>
            </div>
          </div>

          <span class="text-xs text-muted-foreground shrink-0">
            {{ f.duration(session.endedAt.getTime() - session.startedAt.getTime()) }}
          </span>
        </div>
      </div>
    </Section>
  </div>
</template>
