<!--
  CharacterOverviewTab
  Overview tab content for character detail dialog.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { useCharacter } from '@renderer/composables/use-character'
import { Section, SectionScroll } from '@renderer/components/ui/section'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { GameCard, GameDetailDialog } from '@renderer/components/shared/game'
import { AnimeCard } from '@renderer/components/shared/anime'
import { PersonCard, PersonDetailDialog } from '@renderer/components/shared/person'
import { TagCard, TagDetailDialog } from '@renderer/components/shared/tag'
import {
  CharacterDescriptionFormDialog,
  CharacterPersonsFormDialog,
  CharacterExternalSitesFormDialog,
  CharacterTagsFormDialog,
  CharacterGamesFormDialog
} from '../../forms'
import { useI18n } from '@renderer/composables'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'

const { m } = useI18n()

// =============================================================================
// State
// =============================================================================

const { character, tags, persons, games, animes } = useCharacter()

// Edit dialog states
const editDialogs = ref({
  description: false,
  persons: false,
  sites: false,
  tags: false,
  games: false
})

// Entity dialog states
const openGameId = ref<string | null>(null)
const openPersonId = ref<string | null>(null)
const openTagId = ref<string | null>(null)

// =============================================================================
// Constants
// =============================================================================

const PERSON_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.characterPerson
)

const PERSON_ROLE_ORDER = ['actor', 'illustration', 'designer', 'other'] as const

// =============================================================================
// Computed
// =============================================================================

const groupedPersons = computed(() => {
  return persons.value.reduce(
    (acc, link) => {
      const role = link.role || 'other'
      if (!acc[role]) acc[role] = []
      acc[role].push(link)
      return acc
    },
    {} as Record<string, typeof persons.value>
  )
})

const hasExternalSites = computed(
  () => character.value?.externalSites && character.value.externalSites.length > 0
)
const hasPersons = computed(() => persons.value.length > 0)
const hasTags = computed(() => tags.value && tags.value.length > 0)

const gameLinks = computed(() => games.value.filter((link) => link.game))
const animeLinks = computed(() => animes.value.filter((link) => link.anime))

// =============================================================================
// Helpers
// =============================================================================

function openEditDialog(dialog: keyof typeof editDialogs.value) {
  editDialogs.value[dialog] = true
}

function getRoleLabel(type: string | null | undefined) {
  if (!type) return undefined
  const labels: Record<string, string> = m.value.library.roles.gameCharacter
  return labels[type]
}

function getAnimeRoleLabel(type: string | null | undefined) {
  if (!type) return undefined
  const labels: Record<string, string> = m.value.library.roles.animeCharacter
  return labels[type]
}

// Shared components stay route-unaware: related anime render as plain hash
// links that the router picks up, instead of pushing through useRouter().
function getAnimeDetailHref(animeId: string): string {
  return `#${getEntityDetailPath('anime', animeId)}`
}

const gameDialogOpen = computed({
  get: () => openGameId.value !== null,
  set: (value) => {
    if (!value) openGameId.value = null
  }
})

const personDialogOpen = computed({
  get: () => openPersonId.value !== null,
  set: (value) => {
    if (!value) openPersonId.value = null
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
  <template v-if="character">
    <div class="grid md:grid-cols-[3fr_1fr] grid-cols-1 gap-8">
      <!-- Left column: Description, Related Games, Tags -->
      <div class="space-y-6 min-w-0">
        <Section
          :title="m.library.detail.sections.description"
          editable
          :empty="!character.description"
          :empty-text="m.library.detail.empty.description"
          @edit="openEditDialog('description')"
        >
          <MarkdownContent :content="character.description!" />
        </Section>

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
              :badge-label="getRoleLabel(link.role)"
              @click="openGameId = link.game!.id"
            />
          </template>
        </SectionScroll>

        <SectionScroll
          v-if="animeLinks.length > 0"
          :title="m.library.fields.relatedAnimes"
          :items="animeLinks"
          :get-key="(item) => item.id"
        >
          <template #item="{ item: link }">
            <a
              :href="getAnimeDetailHref(link.anime!.id)"
              class="block"
            >
              <AnimeCard
                :anime="link.anime!"
                align="left"
                size="sm"
                :badge-label="getAnimeRoleLabel(link.role)"
              />
            </a>
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

      <!-- Right column: Related Persons, Related Sites -->
      <div class="space-y-6 min-w-0">
        <Section
          :title="m.library.fields.relatedPersons"
          editable
          :empty="!hasPersons"
          :empty-text="m.library.detail.empty.relatedPersons"
          @edit="openEditDialog('persons')"
        >
          <div class="space-y-2 text-sm">
            <template
              v-for="role in PERSON_ROLE_ORDER"
              :key="role"
            >
              <div v-if="groupedPersons[role]?.length">
                <div class="text-muted-foreground text-xs mb-1">
                  {{ PERSON_ROLE_LABELS[role] || role }}
                </div>
                <div class="flex flex-wrap gap-x-1 gap-y-0.5">
                  <template
                    v-for="(link, index) in groupedPersons[role]"
                    :key="link.id"
                  >
                    <span class="inline-flex items-center max-w-full min-w-0">
                      <PersonCard
                        v-if="link.person"
                        :person="link.person"
                        variant="button"
                        button-variant="link"
                        button-size="xs"
                        @click="openPersonId = link.person.id"
                      />
                      <span
                        v-if="index < groupedPersons[role]!.length - 1"
                        class="text-muted-foreground/50"
                        >,</span
                      >
                    </span>
                  </template>
                </div>
              </div>
            </template>
          </div>
        </Section>

        <Section
          :title="m.library.fields.externalSites"
          editable
          :empty="!hasExternalSites"
          :empty-text="m.library.detail.empty.externalSites"
          @edit="openEditDialog('sites')"
        >
          <div class="flex flex-col gap-1.5">
            <a
              v-for="(site, index) in character.externalSites"
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

    <!-- Edit Dialogs - conditionally rendered -->
    <CharacterDescriptionFormDialog
      v-if="editDialogs.description"
      v-model:open="editDialogs.description"
      :character-id="character.id"
    />
    <CharacterPersonsFormDialog
      v-if="editDialogs.persons"
      v-model:open="editDialogs.persons"
      :character-id="character.id"
    />
    <CharacterExternalSitesFormDialog
      v-if="editDialogs.sites"
      v-model:open="editDialogs.sites"
      :character-id="character.id"
    />
    <CharacterTagsFormDialog
      v-if="editDialogs.tags"
      v-model:open="editDialogs.tags"
      :character-id="character.id"
    />
    <CharacterGamesFormDialog
      v-if="editDialogs.games"
      v-model:open="editDialogs.games"
      :character-id="character.id"
    />

    <!-- Entity Dialogs -->
    <GameDetailDialog
      v-if="openGameId"
      v-model:open="gameDialogOpen"
      :game-id="openGameId"
    />
    <PersonDetailDialog
      v-if="openPersonId"
      v-model:open="personDialogOpen"
      :person-id="openPersonId"
    />
    <TagDetailDialog
      v-if="openTagId"
      v-model:open="tagDialogOpen"
      :tag-id="openTagId"
    />
  </template>
</template>
