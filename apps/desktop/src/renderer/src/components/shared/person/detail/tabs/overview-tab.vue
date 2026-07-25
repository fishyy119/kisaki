<!--
  PersonOverviewTab
  Overview tab with 2-column layout.
  Left: Description, Characters (horizontal scroll), Games (horizontal scroll), Tags
  Right: Related Sites
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { usePerson } from '@renderer/composables/use-person'
import { Section, SectionScroll } from '@renderer/components/ui/section'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { GameCard, GameDetailDialog } from '@renderer/components/shared/game'
import { CharacterCard, CharacterDetailDialog } from '@renderer/components/shared/character'
import { TagCard, TagDetailDialog } from '@renderer/components/shared/tag'
import {
  PersonDescriptionFormDialog,
  PersonRelatedSitesFormDialog,
  PersonTagsFormDialog,
  PersonGamesFormDialog,
  PersonCharactersFormDialog
} from '../../forms'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

const GAME_PERSON_TYPE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.gamePerson
)

const CHARACTER_PERSON_TYPE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.characterPerson
)

// =============================================================================
// State
// =============================================================================

const { person, tags, games, characters } = usePerson()

/** Edit dialog states */
const editDialogs = ref({
  description: false,
  sites: false,
  tags: false,
  games: false,
  characters: false
})

/** Entity detail dialog states */
const openGameId = ref<string | null>(null)
const openCharacterId = ref<string | null>(null)
const openTagId = ref<string | null>(null)

// =============================================================================
// Computed
// =============================================================================

const hasRelatedSites = computed(
  () => person.value?.relatedSites && person.value.relatedSites.length > 0
)
const hasTags = computed(() => tags.value && tags.value.length > 0)

const gameLinks = computed(() => games.value.filter((link) => link.game))
const characterLinks = computed(() => characters.value.filter((link) => link.character))

// =============================================================================
// Helpers
// =============================================================================

function openEditDialog(dialog: keyof typeof editDialogs.value) {
  editDialogs.value[dialog] = true
}

const gameDialogOpen = computed({
  get: () => openGameId.value !== null,
  set: (value) => {
    if (!value) openGameId.value = null
  }
})

const characterDialogOpen = computed({
  get: () => openCharacterId.value !== null,
  set: (value) => {
    if (!value) openCharacterId.value = null
  }
})

const tagDialogOpen = computed({
  get: () => openTagId.value !== null,
  set: (value) => {
    if (!value) openTagId.value = null
  }
})
</script>

<template>
  <template v-if="person">
    <div class="grid md:grid-cols-[3fr_1fr] grid-cols-1 gap-8">
      <!-- Left column: Description, Characters, Games, Tags -->
      <div class="space-y-6 min-w-0">
        <Section
          :title="m.library.detail.sections.description"
          editable
          :empty="!person.description"
          :empty-text="m.library.detail.empty.description"
          @edit="openEditDialog('description')"
        >
          <MarkdownContent :content="person.description!" />
        </Section>

        <SectionScroll
          :title="m.library.fields.relatedCharacters"
          editable
          :items="characterLinks"
          :get-key="(item) => item.id"
          :empty-text="m.library.detail.empty.relatedCharacters"
          @edit="openEditDialog('characters')"
        >
          <template #item="{ item: link }">
            <CharacterCard
              :character="link.character!"
              size="sm"
              align="left"
              :badge-label="link.type ? CHARACTER_PERSON_TYPE_LABELS[link.type] : undefined"
              @click="openCharacterId = link.character!.id"
            />
          </template>
        </SectionScroll>

        <SectionScroll
          :title="m.library.fields.relatedGames"
          editable
          :items="gameLinks"
          :get-key="(item) => item.id"
          :empty-text="m.library.detail.empty.relatedGames"
          @edit="openEditDialog('games')"
        >
          <template #item="{ item: link }">
            <GameCard
              :game="link.game!"
              align="left"
              size="sm"
              :badge-label="link.type ? GAME_PERSON_TYPE_LABELS[link.type] : undefined"
              @click="openGameId = link.game!.id"
            />
          </template>
        </SectionScroll>

        <Section
          :title="m.library.fields.tags"
          editable
          :empty="!hasTags"
          :empty-text="m.library.detail.empty.tags"
          @edit="openEditDialog('tags')"
        >
          <div class="flex flex-wrap gap-1">
            <template
              v-for="tagLink in tags"
              :key="tagLink.id"
            >
              <TagCard
                v-if="tagLink.tag"
                :tag="tagLink.tag"
                variant="button"
                button-size="xs"
                @click="openTagId = tagLink.tag.id"
              />
            </template>
          </div>
        </Section>
      </div>

      <!-- Right column: Related Sites -->
      <div class="space-y-6 min-w-0">
        <Section
          :title="m.library.fields.relatedSites"
          editable
          :empty="!hasRelatedSites"
          :empty-text="m.library.detail.empty.relatedSites"
          @edit="openEditDialog('sites')"
        >
          <div class="flex flex-col gap-1.5">
            <a
              v-for="(site, index) in person.relatedSites"
              :key="index"
              :href="site.url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Icon
                icon="icon-[mdi--open-in-new]"
                class="size-3.5"
              />
              {{ site.label }}
            </a>
          </div>
        </Section>
      </div>
    </div>

    <!-- Edit Dialogs -->
    <PersonDescriptionFormDialog
      v-if="editDialogs.description"
      v-model:open="editDialogs.description"
      :person-id="person.id"
    />
    <PersonRelatedSitesFormDialog
      v-if="editDialogs.sites"
      v-model:open="editDialogs.sites"
      :person-id="person.id"
    />
    <PersonTagsFormDialog
      v-if="editDialogs.tags"
      v-model:open="editDialogs.tags"
      :person-id="person.id"
    />
    <PersonGamesFormDialog
      v-if="editDialogs.games"
      v-model:open="editDialogs.games"
      :person-id="person.id"
    />
    <PersonCharactersFormDialog
      v-if="editDialogs.characters"
      v-model:open="editDialogs.characters"
      :person-id="person.id"
    />

    <!-- Entity Detail Dialogs -->
    <GameDetailDialog
      v-if="openGameId"
      v-model:open="gameDialogOpen"
      :game-id="openGameId"
    />
    <CharacterDetailDialog
      v-if="openCharacterId"
      v-model:open="characterDialogOpen"
      :character-id="openCharacterId"
    />
    <TagDetailDialog
      v-if="openTagId"
      v-model:open="tagDialogOpen"
      :tag-id="openTagId"
    />
  </template>
</template>
