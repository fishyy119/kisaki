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
import { PersonCard } from '@renderer/components/shared/person'
import { TagCard } from '@renderer/components/shared/tag'
import { useI18n } from '@renderer/composables'
import {
  EntityDescriptionFormDialog,
  EntityDetailDialog,
  EntityTagsFormDialog,
  EntityExternalSitesFormDialog,
  EntityLinksFormDialog,
  EntityWorksSection,
  type EntityDetailTarget
} from '@renderer/components/shared/entity'
import { CHARACTER_PERSON_ROLE_VALUES } from '@shared/db'
import { useCharacterWorksBlocks } from '../works'
import { CharacterInfoFormDialog, CharacterPhysiqueFormDialog } from '../../forms'

const { m, f } = useI18n()

// =============================================================================
// State
// =============================================================================

const { character, tags, persons, cast } = useCharacter()
const worksBlocks = useCharacterWorksBlocks()

// Edit dialog states
const editDialogs = ref({
  details: false,
  physique: false,
  description: false,
  persons: false,
  sites: false,
  tags: false
})

/** The entity whose detail dialog is open, if any */
const openEntity = ref<EntityDetailTarget | null>(null)

// =============================================================================
// Constants
// =============================================================================

const PERSON_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.characterPerson
)

const GENDER_LABELS = computed<Record<string, string>>(() => m.value.library.gender)

const BLOOD_TYPE_LABELS = computed<Record<string, string>>(() => m.value.library.bloodType)

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

const aliases = computed(() => character.value?.aliases ?? [])

/**
 * The bust-waist-hips triple in the notation every source publishes it in.
 *
 * Sources issue it as one fact, so a partly known triple still reads as one
 * value with `?` for the missing parts rather than as separate fields.
 */
const threeSizes = computed(() => {
  const entity = character.value
  if (!entity) return undefined
  if (entity.bust === null && entity.waist === null && entity.hips === null) return undefined

  return `B${entity.bust ?? '?'}-W${entity.waist ?? '?'}-H${entity.hips ?? '?'}`
})

/**
 * Whether any physique field is filled.
 *
 * Most characters carry none, and the section's own empty state says that in
 * one line instead of four placeholder rows.
 */
const hasPhysique = computed(() => {
  const entity = character.value
  if (!entity) return false

  return (
    entity.height !== null ||
    entity.weight !== null ||
    entity.cup !== null ||
    threeSizes.value !== undefined
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

      <!-- Right column: Details, Physique, Related Persons, Voice credits, Related Sites -->
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
            <dd>{{ character.gender ? GENDER_LABELS[character.gender] : m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.birthDate }}</dt>
            <dd>{{ character.birthDate ? f.date(character.birthDate) : m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.age }}</dt>
            <dd>
              {{
                character.age !== null
                  ? m.library.detail.ageValue({ age: character.age })
                  : m.common.emptyValue
              }}
            </dd>
            <dt class="text-muted-foreground">{{ m.library.fields.bloodType }}</dt>
            <dd>
              {{
                character.bloodType ? BLOOD_TYPE_LABELS[character.bloodType] : m.common.emptyValue
              }}
            </dd>
            <dt class="text-muted-foreground">{{ m.library.fields.addedDate }}</dt>
            <dd>{{ character.createdAt ? f.date(character.createdAt) : m.common.emptyValue }}</dd>
          </dl>
        </Section>

        <Section
          :title="m.library.detail.sections.physique"
          editable
          :empty="!hasPhysique"
          :empty-text="m.library.detail.empty.physique"
          @edit="openEditDialog('physique')"
        >
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
            <dt class="text-muted-foreground">{{ m.library.fields.height }}</dt>
            <dd>{{ character.height !== null ? `${character.height}cm` : m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.weight }}</dt>
            <dd>{{ character.weight !== null ? `${character.weight}kg` : m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.measurements }}</dt>
            <dd>{{ threeSizes ?? m.common.emptyValue }}</dd>
            <!--
              Cup applies to a subset of characters, so an empty value means
              inapplicable rather than unknown; the row renders only when filled.
            -->
            <template v-if="character.cup">
              <dt class="text-muted-foreground">{{ m.library.fields.cup }}</dt>
              <dd>{{ character.cup.toUpperCase() }}</dd>
            </template>
          </dl>
        </Section>

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
                        @click="openEntity = { entityType: 'person', entityId: link.person.id }"
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
                @click="openEntity = { entityType: credit.mediaType, entityId: credit.mediaId }"
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
    <CharacterInfoFormDialog
      v-if="editDialogs.details"
      v-model:open="editDialogs.details"
      :character-id="character.id"
    />
    <CharacterPhysiqueFormDialog
      v-if="editDialogs.physique"
      v-model:open="editDialogs.physique"
      :character-id="character.id"
    />
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

    <!-- Entity Detail Dialog -->
    <EntityDetailDialog v-model:target="openEntity" />
  </template>
</template>
