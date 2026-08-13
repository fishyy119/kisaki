<!--
  Anime Overview Tab

  Left: description, characters, relations, tags.
  Right: details, staff, studios, links.
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { Section, SectionScroll } from '@renderer/components/ui/section'
import { CharacterCard, CharacterDetailDialog } from '@renderer/components/shared/character'
import { CompanyCard, CompanyDetailDialog } from '@renderer/components/shared/company'
import {
  MediaRelationsFormDialog,
  MediaRelationsSection,
  MediaDescriptionFormDialog
} from '@renderer/components/shared/media'
import { PersonCard, PersonDetailDialog } from '@renderer/components/shared/person'
import { TagCard, TagDetailDialog } from '@renderer/components/shared/tag'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import {
  AnimeInfoFormDialog
  } from '../../forms'
import {
  EntityLinksFormDialog,
  EntityExternalSitesFormDialog,
  EntityTagsFormDialog
} from '@renderer/components/shared/entity'
import { ANIME_CHARACTER_ROLE_VALUES, ANIME_COMPANY_ROLE_VALUES, ANIME_PERSON_ROLE_VALUES } from '@shared/db'

const { anime, tags, characters, persons, companies, relations } = useAnime()
const { m, f } = useI18n()

const PERSON_ROLE_LABELS = computed<Record<string, string>>(() => m.value.library.roles.animePerson)
const COMPANY_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.animeCompany
)
const CHARACTER_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.animeCharacter
)

/** Edit dialog states */
const editDialogs = ref({
  description: false,
  details: false,
  tags: false,
  characters: false,
  staff: false,
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
  () => anime.value?.externalSites && anime.value.externalSites.length > 0
)

const sortedCharacters = computed(() =>
  [...characters.value]
    .sort((a, b) => {
      const roleIndexA = ANIME_CHARACTER_ROLE_VALUES.indexOf(
        (a.role || 'other') as (typeof ANIME_CHARACTER_ROLE_VALUES)[number]
      )
      const roleIndexB = ANIME_CHARACTER_ROLE_VALUES.indexOf(
        (b.role || 'other') as (typeof ANIME_CHARACTER_ROLE_VALUES)[number]
      )
      if (roleIndexA !== roleIndexB) return roleIndexA - roleIndexB
      return a.orderInAnime - b.orderInAnime
    })
    .map((link) => ({
      link,
      character: link.character,
      roleLabel: link.role ? CHARACTER_ROLE_LABELS.value[link.role] : undefined
    }))
    .filter((item) => item.character !== null)
)

const groupedPersons = computed(() =>
  persons.value.reduce(
    (acc, link) => {
      const role = link.role || 'other'
      if (!acc[role]) acc[role] = []
      acc[role].push(link)
      return acc
    },
    {} as Record<string, typeof persons.value>
  )
)

const groupedCompanies = computed(() =>
  companies.value.reduce(
    (acc, link) => {
      const role = link.role || 'other'
      if (!acc[role]) acc[role] = []
      acc[role].push(link)
      return acc
    },
    {} as Record<string, typeof companies.value>
  )
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
  <template v-if="anime">
    <div class="grid md:grid-cols-[3fr_1fr] grid-cols-1 gap-8">
      <div class="space-y-6 min-w-0">
        <Section
          :title="m.library.detail.sections.description"
          editable
          :empty="!anime.description"
          :empty-text="m.library.detail.empty.description"
          @edit="openEditDialog('description')"
        >
          <MarkdownContent :content="anime.description!" />
        </Section>

        <SectionScroll
          :title="m.library.detail.tabs.characters"
          editable
          :items="sortedCharacters"
          :get-key="(item) => item.link.id"
          :empty-text="m.library.detail.empty.characters"
          @edit="openEditDialog('characters')"
        >
          <template #item="{ item }">
            <CharacterCard
              v-if="item.character"
              :character="item.character"
              size="sm"
              align="left"
              :badge-label="item.roleLabel"
              @click="openCharacterId = item.character.id"
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
            <dd>{{ m.library.animeFormat[anime.format] }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.totalEpisodes }}</dt>
            <dd>{{ anime.totalEpisodes ?? m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.releaseDate }}</dt>
            <dd>{{ anime.releaseDate ? f.date(anime.releaseDate) : m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.addedDate }}</dt>
            <dd>{{ anime.createdAt ? f.date(anime.createdAt) : m.common.emptyValue }}</dd>
          </dl>
        </Section>

        <Section
          :title="m.library.detail.tabs.persons"
          editable
          :empty="persons.length === 0"
          :empty-text="m.library.detail.empty.persons"
          @edit="openEditDialog('staff')"
        >
          <div class="space-y-2 text-sm">
            <template
              v-for="role in ANIME_PERSON_ROLE_VALUES"
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
                        v-if="index < groupedPersons[role].length - 1"
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
          :title="m.library.detail.tabs.companies"
          editable
          :empty="companies.length === 0"
          :empty-text="m.library.detail.empty.companies"
          @edit="openEditDialog('companies')"
        >
          <div class="space-y-2 text-sm">
            <template
              v-for="role in ANIME_COMPANY_ROLE_VALUES"
              :key="role"
            >
              <div v-if="groupedCompanies[role]?.length">
                <div class="text-muted-foreground text-xs mb-1">
                  {{ COMPANY_ROLE_LABELS[role] || role }}
                </div>
                <div class="flex flex-wrap gap-x-1 gap-y-0.5">
                  <template
                    v-for="(link, index) in groupedCompanies[role]"
                    :key="link.id"
                  >
                    <span class="inline-flex items-center max-w-full min-w-0">
                      <CompanyCard
                        v-if="link.company"
                        :company="link.company"
                        variant="button"
                        button-variant="link"
                        button-size="xs"
                        @click="openCompanyId = link.company.id"
                      />
                      <span
                        v-if="index < groupedCompanies[role].length - 1"
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
          @edit="openEditDialog('externalSites')"
        >
          <div class="flex flex-col gap-1.5">
            <a
              v-for="(site, index) in anime.externalSites"
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
      media-type="anime"
      :entity-id="anime.id"
    />
    <AnimeInfoFormDialog
      v-if="editDialogs.details"
      v-model:open="editDialogs.details"
      :anime-id="anime.id"
    />
    <EntityTagsFormDialog
      v-if="editDialogs.tags"
      v-model:open="editDialogs.tags"
      entity-type="anime"
      :entity-id="anime.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.characters"
      v-model:open="editDialogs.characters"
      view="anime-characters"
      :entity-id="anime.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.staff"
      v-model:open="editDialogs.staff"
      view="anime-persons"
      :entity-id="anime.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.companies"
      v-model:open="editDialogs.companies"
      view="anime-companies"
      :entity-id="anime.id"
    />
    <EntityExternalSitesFormDialog
      v-if="editDialogs.externalSites"
      v-model:open="editDialogs.externalSites"
      entity-type="anime"
      :entity-id="anime.id"
    />
    <MediaRelationsFormDialog
      v-if="editDialogs.relations"
      v-model:open="editDialogs.relations"
      media-type="anime"
      :entity-id="anime.id"
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
