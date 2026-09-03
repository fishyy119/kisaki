<!--
  Comic Overview Tab

  Left: description, characters, relations, tags.
  Right: details, creators, companies, links.
  Role-grouped sidebar lists clamp per role; "+N" jumps to the full tab.
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { Section, SectionScroll } from '@renderer/components/ui/section'
import { CharacterCard } from '@renderer/components/shared/character'
import {
  MediaRelationsFormDialog,
  MediaRelationsSection,
  MediaDescriptionFormDialog
} from '@renderer/components/shared/media'
import { TagCard } from '@renderer/components/shared/tag'
import { useComic } from '@renderer/composables/use-comic'
import { useI18n } from '@renderer/composables/use-i18n'
import { ComicInfoFormDialog } from '../../forms'
import {
  EntityDetailDialog,
  EntityLinksFormDialog,
  EntityExternalSitesFormDialog,
  EntityRoleLinksSection,
  EntityTagsFormDialog,
  type EntityDetailTarget,
  type RoleLinkItem
} from '@renderer/components/shared/entity'
import {
  COMIC_CHARACTER_ROLE_VALUES,
  COMIC_COMPANY_ROLE_VALUES,
  COMIC_PERSON_ROLE_VALUES
} from '@shared/db'
const { comic, tags, characters, persons, companies, relations } = useComic()
const { m, f } = useI18n()

const emit = defineEmits<{
  /** Ask the host tab shell to switch to another detail tab. */
  navigate: [tab: 'persons' | 'companies']
}>()

const PERSON_ROLE_LABELS = computed<Record<string, string>>(() => m.value.library.roles.comicPerson)
const COMPANY_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.comicCompany
)
const CHARACTER_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.comicCharacter
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

const openEntity = ref<EntityDetailTarget | null>(null)

const aliases = computed(() => comic.value?.aliases ?? [])
const hasExternalSites = computed(
  () => comic.value?.externalSites && comic.value.externalSites.length > 0
)

const sortedCharacters = computed(() =>
  [...characters.value]
    .sort((a, b) => {
      const roleIndexA = COMIC_CHARACTER_ROLE_VALUES.indexOf(
        (a.role || 'other') as (typeof COMIC_CHARACTER_ROLE_VALUES)[number]
      )
      const roleIndexB = COMIC_CHARACTER_ROLE_VALUES.indexOf(
        (b.role || 'other') as (typeof COMIC_CHARACTER_ROLE_VALUES)[number]
      )
      if (roleIndexA !== roleIndexB) return roleIndexA - roleIndexB
      return a.orderInComic - b.orderInComic
    })
    .map((link) => ({
      link,
      character: link.character,
      roleLabel: link.role ? CHARACTER_ROLE_LABELS.value[link.role] : undefined
    }))
    .filter((item) => item.character !== null)
)

const personItems = computed<RoleLinkItem[]>(() =>
  persons.value.map((link) => ({ id: link.id, role: link.role, entity: link.person }))
)

const companyItems = computed<RoleLinkItem[]>(() =>
  companies.value.map((link) => ({ id: link.id, role: link.role, entity: link.company }))
)
</script>

<template>
  <template v-if="comic">
    <div class="grid md:grid-cols-[3fr_1fr] grid-cols-1 gap-8">
      <div class="space-y-6 min-w-0">
        <Section
          :title="m.library.detail.sections.description"
          editable
          :empty="!comic.description"
          :empty-text="m.library.detail.empty.description"
          @edit="openEditDialog('description')"
        >
          <MarkdownContent :content="comic.description!" />
        </Section>

        <SectionScroll
          :title="m.library.detail.tabs.characters"
          memory-key="characters"
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
              @click="openEntity = { entityType: 'character', entityId: item.character.id }"
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
                @click="openEntity = { entityType: 'tag', entityId: tagLink.tag.id }"
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
            <dd v-else>{{ m.values.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.format }}</dt>
            <dd>{{ m.library.comicFormat[comic.format] }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.totalVolumes }}</dt>
            <dd>{{ comic.totalVolumes ?? m.values.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.totalChapters }}</dt>
            <dd>{{ comic.totalChapters ?? m.values.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.releaseDate }}</dt>
            <dd>{{ comic.releaseDate ? f.date(comic.releaseDate) : m.values.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.addedDate }}</dt>
            <dd>{{ comic.createdAt ? f.date(comic.createdAt) : m.values.emptyValue }}</dd>
          </dl>
        </Section>

        <EntityRoleLinksSection
          :title="m.library.detail.tabs.persons"
          :empty-text="m.library.detail.empty.persons"
          entity-type="person"
          :items="personItems"
          :role-order="COMIC_PERSON_ROLE_VALUES"
          :role-labels="PERSON_ROLE_LABELS"
          @edit="openEditDialog('persons')"
          @open="openEntity = { entityType: 'person', entityId: $event }"
          @view-all="emit('navigate', 'persons')"
        />

        <EntityRoleLinksSection
          :title="m.library.detail.tabs.companies"
          :empty-text="m.library.detail.empty.companies"
          entity-type="company"
          :items="companyItems"
          :role-order="COMIC_COMPANY_ROLE_VALUES"
          :role-labels="COMPANY_ROLE_LABELS"
          @edit="openEditDialog('companies')"
          @open="openEntity = { entityType: 'company', entityId: $event }"
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
              v-for="(site, index) in comic.externalSites"
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
      media-type="comic"
      :entity-id="comic.id"
    />
    <ComicInfoFormDialog
      v-if="editDialogs.details"
      v-model:open="editDialogs.details"
      :comic-id="comic.id"
    />
    <EntityTagsFormDialog
      v-if="editDialogs.tags"
      v-model:open="editDialogs.tags"
      entity-type="comic"
      :entity-id="comic.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.characters"
      v-model:open="editDialogs.characters"
      view="comic-characters"
      :entity-id="comic.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.persons"
      v-model:open="editDialogs.persons"
      view="comic-persons"
      :entity-id="comic.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.companies"
      v-model:open="editDialogs.companies"
      view="comic-companies"
      :entity-id="comic.id"
    />
    <EntityExternalSitesFormDialog
      v-if="editDialogs.externalSites"
      v-model:open="editDialogs.externalSites"
      entity-type="comic"
      :entity-id="comic.id"
    />
    <MediaRelationsFormDialog
      v-if="editDialogs.relations"
      v-model:open="editDialogs.relations"
      media-type="comic"
      :entity-id="comic.id"
    />

    <EntityDetailDialog v-model:target="openEntity" />
  </template>
</template>
