<!--
  PersonOverviewTab
  Overview tab with 2-column layout.
  Left: Description, Characters, Works (horizontal scrolls), Tags
  Right: Details, Voice credits, Related Sites
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { usePerson } from '@renderer/composables/use-person'
import { Section, SectionScroll } from '@renderer/components/ui/section'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { CharacterCard } from '@renderer/components/shared/character'
import { TagCard } from '@renderer/components/shared/tag'
import {
  EntityDescriptionFormDialog,
  EntityDetailDialog,
  EntityLinksFormDialog,
  EntityExternalSitesFormDialog,
  EntityTagsFormDialog,
  EntityWorksSection,
  type EntityDetailTarget
} from '@renderer/components/shared/entity'
import { useI18n } from '@renderer/composables'
import { usePersonWorksBlocks } from '../works'
import { PersonInfoFormDialog } from '../../forms'

const { m, f } = useI18n()

const CHARACTER_PERSON_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.characterPerson
)

const GENDER_LABELS = computed<Record<string, string>>(() => m.value.library.gender)

// =============================================================================
// State
// =============================================================================

const { person, tags, characters, cast } = usePerson()
const worksBlocks = usePersonWorksBlocks()

/** Edit dialog states */
const editDialogs = ref({
  details: false,
  description: false,
  sites: false,
  tags: false,
  characters: false
})

/** The entity whose detail dialog is open, if any */
const openEntity = ref<EntityDetailTarget | null>(null)

// =============================================================================
// Computed
// =============================================================================

const hasExternalSites = computed(
  () => person.value?.externalSites && person.value.externalSites.length > 0
)
const hasTags = computed(() => tags.value && tags.value.length > 0)
const hasCast = computed(() => cast.value.length > 0)

const characterLinks = computed(() => characters.value.filter((link) => link.character))

const aliases = computed(() => person.value?.aliases ?? [])

// =============================================================================
// Helpers
// =============================================================================

function openEditDialog(dialog: keyof typeof editDialogs.value) {
  editDialogs.value[dialog] = true
}
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
              @click="openEntity = { entityType: 'character', entityId: link.character!.id }"
            />
          </template>
        </SectionScroll>

        <EntityWorksSection
          :blocks="worksBlocks"
          @open="(mediaType, id) => (openEntity = { entityType: mediaType, entityId: id })"
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
                @click="openEntity = { entityType: 'tag', entityId: tagLink.tag.id }"
              />
            </template>
          </div>
        </Section>
      </div>

      <!-- Right column: Details, Voice credits, Related Sites -->
      <div class="space-y-6 min-w-0">
        <Section
          :title="m.library.detail.sections.details"
          editable
          @edit="openEditDialog('details')"
        >
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
            <dt class="text-muted-foreground">{{ m.library.fields.aliases }}</dt>
            <!-- One name per line: a name is atomic and must not wrap mid-word. -->
            <dd
              v-if="aliases.length > 0"
              class="min-w-0 space-y-0.5"
            >
              <div
                v-for="alias in aliases"
                :key="alias"
                class="break-words"
              >
                {{ alias }}
              </div>
            </dd>
            <dd v-else>{{ m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.gender }}</dt>
            <dd>
              {{ person.gender ? GENDER_LABELS[person.gender] : m.common.emptyValue }}
            </dd>
            <dt class="text-muted-foreground">{{ m.library.fields.birthDate }}</dt>
            <dd>{{ person.birthDate ? f.date(person.birthDate) : m.common.emptyValue }}</dd>
            <!--
              A death date does not apply to the living, so an empty value means
              inapplicable rather than unknown; the row renders only when filled.
            -->
            <template v-if="person.deathDate">
              <dt class="text-muted-foreground">{{ m.library.fields.deathDate }}</dt>
              <dd>{{ f.date(person.deathDate) }}</dd>
            </template>
            <dt class="text-muted-foreground">{{ m.library.fields.addedDate }}</dt>
            <dd>{{ person.createdAt ? f.date(person.createdAt) : m.common.emptyValue }}</dd>
          </dl>
        </Section>

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
                @click="openEntity = { entityType: credit.mediaType, entityId: credit.mediaId }"
              >
                {{ credit.mediaName }}
              </button>
              <button
                v-if="credit.character"
                type="button"
                class="text-muted-foreground text-xs hover:underline truncate"
                @click="openEntity = { entityType: 'character', entityId: credit.character.id }"
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
    <PersonInfoFormDialog
      v-if="editDialogs.details"
      v-model:open="editDialogs.details"
      :person-id="person.id"
    />
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

    <!-- Entity Detail Dialog -->
    <EntityDetailDialog v-model:target="openEntity" />
  </template>
</template>
