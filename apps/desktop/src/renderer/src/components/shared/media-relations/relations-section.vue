<!--
  MediaRelationsSection
  Related media entries grouped by relation type; incoming edges arrive
  pre-labelled with the inverse vocabulary. Renders the matching media card
  per target type and navigates to its detail route as a plain hash link.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { MEDIA_RELATION_TYPES } from '@shared/db'
import { Section } from '@renderer/components/ui/section'
import { AnimeCard } from '@renderer/components/shared/anime'
import { GameCard } from '@renderer/components/shared/game'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import type { MediaRelationEntry } from '@renderer/core/db/media-relations'

interface Props {
  relations: MediaRelationEntry[]
  editable?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  edit: []
}>()

const { m } = useI18n()

const RELATION_TYPE_LABELS = computed<Record<string, string>>(() => m.value.library.mediaRelation)

// Entries arrive ordered (out-edges by orderInFrom, then in-edges); grouping
// only buckets them by display type.
const groups = computed(() =>
  MEDIA_RELATION_TYPES.map((type) => ({
    type,
    entries: props.relations.filter((entry) => entry.type === type)
  })).filter((group) => group.entries.length > 0)
)

function getDetailHref(entry: MediaRelationEntry): string {
  return `#${getEntityDetailPath(entry.target.mediaType, entry.target.id)}`
}
</script>

<template>
  <Section
    :title="m.library.fields.relatedEntries"
    :editable="editable"
    :empty="relations.length === 0"
    :empty-text="m.library.detail.empty.relatedEntries"
    @edit="emit('edit')"
  >
    <div class="space-y-4">
      <div
        v-for="group in groups"
        :key="group.type"
      >
        <div class="text-muted-foreground text-xs mb-2">
          {{ RELATION_TYPE_LABELS[group.type] || group.type }}
        </div>
        <div class="grid grid-cols-[repeat(auto-fill,6rem)] gap-3">
          <a
            v-for="entry in group.entries"
            :key="`${entry.id}:${entry.direction}`"
            :href="getDetailHref(entry)"
            class="block"
          >
            <GameCard
              v-if="entry.targetGame"
              :game="entry.targetGame"
              size="sm"
              align="left"
            />
            <AnimeCard
              v-else-if="entry.targetAnime"
              :anime="entry.targetAnime"
              size="sm"
              align="left"
            />
          </a>
        </div>
      </div>
    </div>
  </Section>
</template>
