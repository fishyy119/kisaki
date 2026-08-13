<!--
  MediaRelationsSection
  Related media entries as one ordered card row; incoming edges arrive
  pre-labelled with the inverse vocabulary. The relation type renders as
  the card's bottom badge and clicking opens the target's detail dialog.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Section } from '@renderer/components/ui/section'
import { AnimeCard, AnimeDetailDialog } from '@renderer/components/shared/anime'
import { GameCard, GameDetailDialog } from '@renderer/components/shared/game'
import { useI18n } from '@renderer/composables/use-i18n'
import type { MediaRelationEntry } from '@renderer/core/db/media-relations'

interface Props {
  relations: MediaRelationEntry[]
  editable?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  edit: []
}>()

const { m } = useI18n()

const RELATION_TYPE_LABELS = computed<Record<string, string>>(() => m.value.library.mediaRelation)

const openGameId = ref<string | null>(null)
const openAnimeId = ref<string | null>(null)

const gameDialogOpen = computed({
  get: () => openGameId.value !== null,
  set: (value) => {
    if (!value) openGameId.value = null
  }
})

const animeDialogOpen = computed({
  get: () => openAnimeId.value !== null,
  set: (value) => {
    if (!value) openAnimeId.value = null
  }
})

function getTypeLabel(entry: MediaRelationEntry): string {
  return RELATION_TYPE_LABELS.value[entry.type] || entry.type
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
    <div class="grid grid-cols-[repeat(auto-fill,6rem)] gap-3">
      <template
        v-for="entry in relations"
        :key="`${entry.id}:${entry.direction}`"
      >
        <GameCard
          v-if="entry.targetGame"
          :game="entry.targetGame"
          size="sm"
          align="left"
          :badge-label="getTypeLabel(entry)"
          @click="openGameId = entry.targetGame.id"
        />
        <AnimeCard
          v-else-if="entry.targetAnime"
          :anime="entry.targetAnime"
          size="sm"
          align="left"
          :badge-label="getTypeLabel(entry)"
          @click="openAnimeId = entry.targetAnime.id"
        />
      </template>
    </div>

    <GameDetailDialog
      v-if="openGameId"
      v-model:open="gameDialogOpen"
      :game-id="openGameId"
    />
    <AnimeDetailDialog
      v-if="openAnimeId"
      v-model:open="animeDialogOpen"
      :anime-id="openAnimeId"
    />
  </Section>
</template>
