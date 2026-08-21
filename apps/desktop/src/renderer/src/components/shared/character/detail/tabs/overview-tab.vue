<!--
  CharacterOverviewTab
  Overview tab content for character detail dialog.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { useCharacter } from '@renderer/composables/use-character'
import { Section } from '@renderer/components/ui/section'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { GameDetailDialog } from '@renderer/components/shared/game'
import { AnimeDetailDialog } from '@renderer/components/shared/anime'
import { PersonCard, PersonDetailDialog } from '@renderer/components/shared/person'
import { TagCard, TagDetailDialog } from '@renderer/components/shared/tag'
import { useI18n } from '@renderer/composables'
import {
  EntityDescriptionFormDialog,
  EntityTagsFormDialog,
  EntityExternalSitesFormDialog,
  EntityLinksFormDialog,
  EntityWorksSection
} from '@renderer/components/shared/entity'
import type { MediaType } from '@shared/common'
import { CHARACTER_PERSON_ROLE_VALUES } from '@shared/db'
import { useCharacterWorksBlocks } from '../works'

const { m } = useI18n()

// =============================================================================
// State
// =============================================================================

const { character, tags, persons, cast } = useCharacter()
const worksBlocks = useCharacterWorksBlocks()

// Edit dialog states
const editDialogs = ref({
  description: false,
  persons: false,
  sites: false,
  tags: false
})

// Entity dialog states
const openWork = ref<{ mediaType: MediaType; id: string } | null>(null)
const openPersonId = ref<string | null>(null)
const openTagId = ref<string | null>(null)

// =============================================================================
// Constants
// =============================================================================

const PERSON_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.characterPerson
)

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
const hasCast = computed(() => cast.value.length > 0)
const hasTags = computed(() => tags.value && tags.value.length > 0)

// =============================================================================
// Helpers
// =============================================================================

function openEditDialog(dialog: keyof typeof editDialogs.value) {
  editDialogs.value[dialog] = true
}

const workDialogOpen = computed({
  get: () => openWork.value !== null,
  set: (value) => {
    if (!value) openWork.value = null
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
      <!-- Left column: Description, Works, Tags -->
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

        <EntityWorksSection
          :blocks="worksBlocks"
          @open="(mediaType, id) => (openWork = { mediaType, id })"
        />

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
              v-for="role in CHARACTER_PERSON_ROLE_VALUES"
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

        <!--
          Where the character is actually voiced, entry by entry. The list above
          says who voices them at all; this says where that was credited, which
          is what makes a recast visible.
        -->
        <Section
          :title="m.library.fields.voiceCredits"
          :empty="!hasCast"
          :empty-text="m.library.detail.empty.voiceCredits"
        >
          <div class="space-y-1.5 text-sm">
            <div
              v-for="credit in cast"
              :key="credit.id"
              class="flex items-baseline gap-2 min-w-0"
            >
              <button
                type="button"
                class="text-primary hover:underline truncate"
                @click="openWork = { mediaType: credit.mediaType, id: credit.mediaId }"
              >
                {{ credit.mediaName }}
              </button>
              <span
                v-if="credit.person"
                class="text-muted-foreground text-xs truncate"
              >
                {{ credit.person.name }}
              </span>
            </div>
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
    <EntityDescriptionFormDialog
      v-if="editDialogs.description"
      v-model:open="editDialogs.description"
      entity-type="character"
      :entity-id="character.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.persons"
      v-model:open="editDialogs.persons"
      view="character-persons"
      :entity-id="character.id"
    />
    <EntityExternalSitesFormDialog
      v-if="editDialogs.sites"
      v-model:open="editDialogs.sites"
      entity-type="character"
      :entity-id="character.id"
    />
    <EntityTagsFormDialog
      v-if="editDialogs.tags"
      v-model:open="editDialogs.tags"
      entity-type="character"
      :entity-id="character.id"
    />

    <!-- Entity Dialogs -->
    <template v-if="openWork">
      <GameDetailDialog
        v-if="openWork.mediaType === 'game'"
        v-model:open="workDialogOpen"
        :game-id="openWork.id"
      />
      <AnimeDetailDialog
        v-else
        v-model:open="workDialogOpen"
        :anime-id="openWork.id"
      />
    </template>
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
