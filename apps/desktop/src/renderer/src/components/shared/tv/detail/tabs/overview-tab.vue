<!--
  Tv Overview Tab

  Live action credits the cast first, so the main column leads with actor
  cards subtitled by the characters they play.

  Left: description, cast, relations, tags.
  Right: details, crew, characters, companies, links.
  Role-grouped sidebar lists clamp per role; "+N" jumps to the full tab.
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { Section, SectionScroll } from '@renderer/components/ui/section'
import { CharacterDetailDialog } from '@renderer/components/shared/character'
import { CompanyDetailDialog } from '@renderer/components/shared/company'
import {
  MediaRelationsFormDialog,
  MediaRelationsSection,
  MediaDescriptionFormDialog
} from '@renderer/components/shared/media'
import { PersonCard, PersonDetailDialog } from '@renderer/components/shared/person'
import { TagCard, TagDetailDialog } from '@renderer/components/shared/tag'
import { useTv } from '@renderer/composables/use-tv'
import { useI18n } from '@renderer/composables/use-i18n'
import { formatPlaying } from '@renderer/utils/format'
import { TvInfoFormDialog } from '../../forms'
import {
  EntityLinksFormDialog,
  EntityExternalSitesFormDialog,
  EntityRoleLinksSection,
  EntityTagsFormDialog,
  type RoleLinkItem
} from '@renderer/components/shared/entity'
import { TV_CHARACTER_ROLE_VALUES, TV_COMPANY_ROLE_VALUES, TV_CREW_ROLE_VALUES } from '@shared/db'

const { tv, tags, characters, persons, companies, relations } = useTv()
const { m, f } = useI18n()

const emit = defineEmits<{
  /** Ask the host tab shell to switch to another detail tab. */
  navigate: [tab: 'persons' | 'characters' | 'companies']
}>()

const PERSON_ROLE_LABELS = computed<Record<string, string>>(() => m.value.library.roles.tvPerson)
const COMPANY_ROLE_LABELS = computed<Record<string, string>>(() => m.value.library.roles.tvCompany)
const CHARACTER_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.tvCharacter
)

/** Edit dialog states */
const editDialogs = ref({
  description: false,
  details: false,
  tags: false,
  characters: false,
  persons: false,
  companies: false,
  externalSites: false,
  relations: false
})

function openEditDialog(dialog: keyof typeof editDialogs.value) {
  editDialogs.value[dialog] = true
}

const openCharacterId = ref<string | null>(null)
const openPersonId = ref<string | null>(null)
const openCompanyId = ref<string | null>(null)
const openTagId = ref<string | null>(null)

const hasExternalSites = computed(
  () => tv.value?.externalSites && tv.value.externalSites.length > 0
)

const castEntries = computed(() =>
  persons.value
    .filter((link) => link.role === 'actor' && link.person !== null)
    .map((link) => ({ link, person: link.person!, subtitle: formatPlaying(link.playing) }))
)

const crewItems = computed<RoleLinkItem[]>(() =>
  persons.value
    .filter((link) => link.role !== 'actor')
    .map((link) => ({ id: link.id, role: link.role, entity: link.person }))
)

const characterItems = computed<RoleLinkItem[]>(() =>
  characters.value.map((link) => ({ id: link.id, role: link.role, entity: link.character }))
)

const companyItems = computed<RoleLinkItem[]>(() =>
  companies.value.map((link) => ({ id: link.id, role: link.role, entity: link.company }))
)

const characterDialogOpen = computed({
  get: () => openCharacterId.value !== null,
  set: (value) => {
    if (!value) openCharacterId.value = null
  }
})

const personDialogOpen = computed({
  get: () => openPersonId.value !== null,
  set: (value) => {
    if (!value) openPersonId.value = null
  }
})

const companyDialogOpen = computed({
  get: () => openCompanyId.value !== null,
  set: (value) => {
    if (!value) openCompanyId.value = null
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
  <template v-if="tv">
    <div class="grid md:grid-cols-[3fr_1fr] grid-cols-1 gap-8">
      <div class="space-y-6 min-w-0">
        <Section
          :title="m.library.detail.sections.description"
          editable
          :empty="!tv.description"
          :empty-text="m.library.detail.empty.description"
          @edit="openEditDialog('description')"
        >
          <MarkdownContent :content="tv.description!" />
        </Section>

        <SectionScroll
          :title="m.library.detail.sections.cast"
          editable
          :items="castEntries"
          :get-key="(item) => item.link.id"
          :empty-text="m.library.detail.empty.cast"
          @edit="openEditDialog('persons')"
        >
          <template #item="{ item }">
            <PersonCard
              :person="item.person"
              :subtitle="item.subtitle"
              size="sm"
              align="left"
              @click="openPersonId = item.person.id"
            />
          </template>
        </SectionScroll>

        <MediaRelationsSection
          :relations="relations"
          editable
          @edit="openEditDialog('relations')"
        />

        <Section
          :title="m.library.fields.tags"
          editable
          :empty="tags.length === 0"
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

      <div class="space-y-6 min-w-0">
        <Section
          :title="m.library.detail.sections.details"
          editable
          @edit="openEditDialog('details')"
        >
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
            <dt class="text-muted-foreground">{{ m.library.fields.format }}</dt>
            <dd>{{ m.library.tvFormat[tv.format] }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.totalSeasons }}</dt>
            <dd>{{ tv.totalSeasons ?? m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.totalEpisodes }}</dt>
            <dd>{{ tv.totalEpisodes ?? m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.releaseDate }}</dt>
            <dd>{{ tv.releaseDate ? f.date(tv.releaseDate) : m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.endDate }}</dt>
            <dd>{{ tv.endDate ? f.date(tv.endDate) : m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.addedDate }}</dt>
            <dd>{{ tv.createdAt ? f.date(tv.createdAt) : m.common.emptyValue }}</dd>
          </dl>
        </Section>

        <EntityRoleLinksSection
          :title="m.library.detail.sections.crew"
          :empty-text="m.library.detail.empty.crew"
          entity-type="person"
          :items="crewItems"
          :role-order="TV_CREW_ROLE_VALUES"
          :role-labels="PERSON_ROLE_LABELS"
          @edit="openEditDialog('persons')"
          @open="openPersonId = $event"
          @view-all="emit('navigate', 'persons')"
        />

        <EntityRoleLinksSection
          :title="m.library.detail.tabs.characters"
          :empty-text="m.library.detail.empty.characters"
          entity-type="character"
          :items="characterItems"
          :role-order="TV_CHARACTER_ROLE_VALUES"
          :role-labels="CHARACTER_ROLE_LABELS"
          @edit="openEditDialog('characters')"
          @open="openCharacterId = $event"
          @view-all="emit('navigate', 'characters')"
        />

        <EntityRoleLinksSection
          :title="m.library.detail.tabs.companies"
          :empty-text="m.library.detail.empty.companies"
          entity-type="company"
          :items="companyItems"
          :role-order="TV_COMPANY_ROLE_VALUES"
          :role-labels="COMPANY_ROLE_LABELS"
          @edit="openEditDialog('companies')"
          @open="openCompanyId = $event"
          @view-all="emit('navigate', 'companies')"
        />

        <Section
          :title="m.library.fields.externalSites"
          editable
          :empty="!hasExternalSites"
          :empty-text="m.library.detail.empty.externalSites"
          @edit="openEditDialog('externalSites')"
        >
          <div class="flex flex-col gap-1.5">
            <a
              v-for="(site, index) in tv.externalSites"
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
    <MediaDescriptionFormDialog
      v-if="editDialogs.description"
      v-model:open="editDialogs.description"
      media-type="tv"
      :entity-id="tv.id"
    />
    <TvInfoFormDialog
      v-if="editDialogs.details"
      v-model:open="editDialogs.details"
      :tv-id="tv.id"
    />
    <EntityTagsFormDialog
      v-if="editDialogs.tags"
      v-model:open="editDialogs.tags"
      entity-type="tv"
      :entity-id="tv.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.characters"
      v-model:open="editDialogs.characters"
      view="tv-characters"
      :entity-id="tv.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.persons"
      v-model:open="editDialogs.persons"
      view="tv-persons"
      :entity-id="tv.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.companies"
      v-model:open="editDialogs.companies"
      view="tv-companies"
      :entity-id="tv.id"
    />
    <EntityExternalSitesFormDialog
      v-if="editDialogs.externalSites"
      v-model:open="editDialogs.externalSites"
      entity-type="tv"
      :entity-id="tv.id"
    />
    <MediaRelationsFormDialog
      v-if="editDialogs.relations"
      v-model:open="editDialogs.relations"
      media-type="tv"
      :entity-id="tv.id"
    />

    <CharacterDetailDialog
      v-if="openCharacterId"
      v-model:open="characterDialogOpen"
      :character-id="openCharacterId"
    />
    <PersonDetailDialog
      v-if="openPersonId"
      v-model:open="personDialogOpen"
      :person-id="openPersonId"
    />
    <CompanyDetailDialog
      v-if="openCompanyId"
      v-model:open="companyDialogOpen"
      :company-id="openCompanyId"
    />
    <TagDetailDialog
      v-if="openTagId"
      v-model:open="tagDialogOpen"
      :tag-id="openTagId"
    />
  </template>
</template>
