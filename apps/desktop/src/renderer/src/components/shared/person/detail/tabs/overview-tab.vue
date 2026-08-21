<!--
  PersonOverviewTab
  Overview tab with 2-column layout.
  Left: Description, Characters, Works (horizontal scrolls), Tags
  Right: Related Sites
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { usePerson } from '@renderer/composables/use-person'
import { Section, SectionScroll } from '@renderer/components/ui/section'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { GameDetailDialog } from '@renderer/components/shared/game'
import { AnimeDetailDialog } from '@renderer/components/shared/anime'
import { CharacterCard, CharacterDetailDialog } from '@renderer/components/shared/character'
import { TagCard, TagDetailDialog } from '@renderer/components/shared/tag'
import {
  EntityDescriptionFormDialog,
  EntityLinksFormDialog,
  EntityExternalSitesFormDialog,
  EntityTagsFormDialog,
  EntityWorksSection
} from '@renderer/components/shared/entity'
import { useI18n } from '@renderer/composables'
import type { MediaType } from '@shared/common'
import { usePersonWorksBlocks } from '../works'

const { m } = useI18n()

const CHARACTER_PERSON_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.characterPerson
)

// =============================================================================
// State
// =============================================================================

const { person, tags, characters, cast } = usePerson()
const worksBlocks = usePersonWorksBlocks()

/** Edit dialog states */
const editDialogs = ref({
  description: false,
  sites: false,
  tags: false,
  characters: false
})

/** Entity detail dialog states */
const openWork = ref<{ mediaType: MediaType; id: string } | null>(null)
const openCharacterId = ref<string | null>(null)
const openTagId = ref<string | null>(null)

// =============================================================================
// Computed
// =============================================================================

const hasExternalSites = computed(
  () => person.value?.externalSites && person.value.externalSites.length > 0
)
const hasTags = computed(() => tags.value && tags.value.length > 0)
const hasCast = computed(() => cast.value.length > 0)

const characterLinks = computed(() => characters.value.filter((link) => link.character))

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
      <!-- Left column: Description, Characters, Works, Tags -->
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
              :badge-label="link.role ? CHARACTER_PERSON_ROLE_LABELS[link.role] : undefined"
              @click="openCharacterId = link.character!.id"
            />
          </template>
        </SectionScroll>

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

      <!-- Right column: Voice credits, Related Sites -->
      <div class="space-y-6 min-w-0">
        <!--
          Where the person is actually credited voicing a character. The list
          above says who they voice at all; this says where that was credited,
          which is what separates a role they hold from one they lost.
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
              <button
                v-if="credit.character"
                type="button"
                class="text-muted-foreground text-xs hover:underline truncate"
                @click="openCharacterId = credit.character.id"
              >
                {{ credit.character.name }}
              </button>
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
              v-for="(site, index) in person.externalSites"
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
    <EntityDescriptionFormDialog
      v-if="editDialogs.description"
      v-model:open="editDialogs.description"
      entity-type="person"
      :entity-id="person.id"
    />
    <EntityExternalSitesFormDialog
      v-if="editDialogs.sites"
      v-model:open="editDialogs.sites"
      entity-type="person"
      :entity-id="person.id"
    />
    <EntityTagsFormDialog
      v-if="editDialogs.tags"
      v-model:open="editDialogs.tags"
      entity-type="person"
      :entity-id="person.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.characters"
      v-model:open="editDialogs.characters"
      view="person-characters"
      :entity-id="person.id"
    />

    <!-- Entity Detail Dialogs -->
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
