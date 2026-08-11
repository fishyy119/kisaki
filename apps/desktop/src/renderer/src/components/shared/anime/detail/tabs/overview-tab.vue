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
import { PersonCard, PersonDetailDialog } from '@renderer/components/shared/person'
import { TagCard, TagDetailDialog } from '@renderer/components/shared/tag'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import { AnimeDescriptionFormDialog, AnimeInfoFormDialog } from '../../forms'
import AnimeCard from '../../anime-card.vue'

const PERSON_TYPE_ORDER = [
  'director',
  'series',
  'scenario',
  'characterDesign',
  'music',
  'animationDirector',
  'other'
] as const

const COMPANY_TYPE_ORDER = ['studio', 'producer', 'distributor', 'other'] as const

const CHARACTER_TYPE_ORDER = ['main', 'supporting', 'cameo', 'other'] as const

const RELATION_TYPE_ORDER = [
  'sequel',
  'prequel',
  'sideStory',
  'movie',
  'summary',
  'alternative',
  'other'
] as const

const { anime, tags, characters, persons, companies, relations } = useAnime()
const { m, f } = useI18n()

const PERSON_TYPE_LABELS = computed<Record<string, string>>(() => m.value.library.roles.animePerson)
const COMPANY_TYPE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.animeCompany
)
const CHARACTER_TYPE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.animeCharacter
)
const RELATION_TYPE_LABELS = computed<Record<string, string>>(() => m.value.library.animeRelation)

/** Edit dialog states */
const editDialogs = ref({
  description: false,
  details: false
})

function openEditDialog(dialog: keyof typeof editDialogs.value) {
  editDialogs.value[dialog] = true
}

const openCharacterId = ref<string | null>(null)
const openPersonId = ref<string | null>(null)
const openCompanyId = ref<string | null>(null)
const openTagId = ref<string | null>(null)

const hasRelatedSites = computed(
  () => anime.value?.relatedSites && anime.value.relatedSites.length > 0
)

const sortedCharacters = computed(() =>
  [...characters.value]
    .sort((a, b) => {
      const typeIndexA = CHARACTER_TYPE_ORDER.indexOf(
        (a.type || 'other') as (typeof CHARACTER_TYPE_ORDER)[number]
      )
      const typeIndexB = CHARACTER_TYPE_ORDER.indexOf(
        (b.type || 'other') as (typeof CHARACTER_TYPE_ORDER)[number]
      )
      if (typeIndexA !== typeIndexB) return typeIndexA - typeIndexB
      return a.orderInAnime - b.orderInAnime
    })
    .map((link) => ({
      link,
      character: link.character,
      roleLabel: link.type ? CHARACTER_TYPE_LABELS.value[link.type] : undefined
    }))
    .filter((item) => item.character !== null)
)

const groupedPersons = computed(() =>
  persons.value.reduce(
    (acc, link) => {
      const type = link.type || 'other'
      if (!acc[type]) acc[type] = []
      acc[type].push(link)
      return acc
    },
    {} as Record<string, typeof persons.value>
  )
)

const groupedCompanies = computed(() =>
  companies.value.reduce(
    (acc, link) => {
      const type = link.type || 'other'
      if (!acc[type]) acc[type] = []
      acc[type].push(link)
      return acc
    },
    {} as Record<string, typeof companies.value>
  )
)

// Rows are already ordered by orderInAnime; grouping only buckets them by type.
const relationGroups = computed(() =>
  RELATION_TYPE_ORDER.map((type) => ({
    type,
    links: relations.value.filter((link) => link.type === type && link.relatedAnime)
  })).filter((group) => group.links.length > 0)
)

// Related entries navigate to the anime detail route instead of a nested
// dialog. Shared components stay route-unaware, so they render as plain hash
// links that the router picks up.
function getAnimeDetailHref(animeId: string): string {
  return `#${getEntityDetailPath('anime', animeId)}`
}

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
          :items="sortedCharacters"
          :get-key="(item) => item.link.id"
          :empty-text="m.library.detail.empty.characters"
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

        <Section
          v-if="relationGroups.length > 0"
          :title="m.library.fields.relatedAnimes"
        >
          <div class="space-y-4">
            <div
              v-for="group in relationGroups"
              :key="group.type"
            >
              <div class="text-muted-foreground text-xs mb-2">
                {{ RELATION_TYPE_LABELS[group.type] || group.type }}
              </div>
              <div class="grid grid-cols-[repeat(auto-fill,6rem)] gap-3">
                <a
                  v-for="link in group.links"
                  :key="link.id"
                  :href="getAnimeDetailHref(link.relatedAnime!.id)"
                  class="block"
                >
                  <AnimeCard
                    :anime="link.relatedAnime!"
                    size="sm"
                    align="left"
                  />
                </a>
              </div>
            </div>
          </div>
        </Section>

        <Section
          :title="m.library.fields.tags"
          :empty="tags.length === 0"
          :empty-text="m.library.detail.empty.tags"
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
          :empty="persons.length === 0"
          :empty-text="m.library.detail.empty.persons"
        >
          <div class="space-y-2 text-sm">
            <template
              v-for="type in PERSON_TYPE_ORDER"
              :key="type"
            >
              <div v-if="groupedPersons[type]?.length">
                <div class="text-muted-foreground text-xs mb-1">
                  {{ PERSON_TYPE_LABELS[type] || type }}
                </div>
                <div class="flex flex-wrap gap-x-1 gap-y-0.5">
                  <template
                    v-for="(link, index) in groupedPersons[type]"
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
                        v-if="index < groupedPersons[type].length - 1"
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
          :empty="companies.length === 0"
          :empty-text="m.library.detail.empty.companies"
        >
          <div class="space-y-2 text-sm">
            <template
              v-for="type in COMPANY_TYPE_ORDER"
              :key="type"
            >
              <div v-if="groupedCompanies[type]?.length">
                <div class="text-muted-foreground text-xs mb-1">
                  {{ COMPANY_TYPE_LABELS[type] || type }}
                </div>
                <div class="flex flex-wrap gap-x-1 gap-y-0.5">
                  <template
                    v-for="(link, index) in groupedCompanies[type]"
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
                        v-if="index < groupedCompanies[type].length - 1"
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
          :title="m.library.fields.relatedSites"
          :empty="!hasRelatedSites"
          :empty-text="m.library.detail.empty.relatedSites"
        >
          <div class="flex flex-col gap-1.5">
            <a
              v-for="(site, index) in anime.relatedSites"
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
    <AnimeDescriptionFormDialog
      v-if="editDialogs.description"
      v-model:open="editDialogs.description"
      :anime-id="anime.id"
    />
    <AnimeInfoFormDialog
      v-if="editDialogs.details"
      v-model:open="editDialogs.details"
      :anime-id="anime.id"
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
