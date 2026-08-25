<!--
  Novel Overview Tab

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
import { useNovel } from '@renderer/composables/use-novel'
import { useI18n } from '@renderer/composables/use-i18n'
import { NovelInfoFormDialog } from '../../forms'
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
  NOVEL_CHARACTER_ROLE_VALUES,
  NOVEL_COMPANY_ROLE_VALUES,
  NOVEL_PERSON_ROLE_VALUES
} from '@shared/db'
const { novel, tags, characters, persons, companies, relations } = useNovel()
const { m, f } = useI18n()

const emit = defineEmits<{
  /** Ask the host tab shell to switch to another detail tab. */
  navigate: [tab: 'persons' | 'companies']
}>()

const PERSON_ROLE_LABELS = computed<Record<string, string>>(() => m.value.library.roles.novelPerson)
const COMPANY_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.novelCompany
)
const CHARACTER_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.novelCharacter
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

const aliases = computed(() => novel.value?.aliases ?? [])
const hasExternalSites = computed(
  () => novel.value?.externalSites && novel.value.externalSites.length > 0
)

const sortedCharacters = computed(() =>
  [...characters.value]
    .sort((a, b) => {
      const roleIndexA = NOVEL_CHARACTER_ROLE_VALUES.indexOf(
        (a.role || 'other') as (typeof NOVEL_CHARACTER_ROLE_VALUES)[number]
      )
      const roleIndexB = NOVEL_CHARACTER_ROLE_VALUES.indexOf(
        (b.role || 'other') as (typeof NOVEL_CHARACTER_ROLE_VALUES)[number]
      )
      if (roleIndexA !== roleIndexB) return roleIndexA - roleIndexB
      return a.orderInNovel - b.orderInNovel
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
  <template v-if="novel">
    <div class="grid md:grid-cols-[3fr_1fr] grid-cols-1 gap-8">
      <div class="space-y-6 min-w-0">
        <Section
          :title="m.library.detail.sections.description"
          editable
          :empty="!novel.description"
          :empty-text="m.library.detail.empty.description"
          @edit="openEditDialog('description')"
        >
          <MarkdownContent :content="novel.description!" />
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
            <dd v-else>{{ m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.format }}</dt>
            <dd>{{ m.library.novelFormat[novel.format] }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.totalVolumes }}</dt>
            <dd>{{ novel.totalVolumes ?? m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.releaseDate }}</dt>
            <dd>{{ novel.releaseDate ? f.date(novel.releaseDate) : m.common.emptyValue }}</dd>
            <dt class="text-muted-foreground">{{ m.library.fields.addedDate }}</dt>
            <dd>{{ novel.createdAt ? f.date(novel.createdAt) : m.common.emptyValue }}</dd>
          </dl>
        </Section>

        <EntityRoleLinksSection
          :title="m.library.detail.tabs.persons"
          :empty-text="m.library.detail.empty.persons"
          entity-type="person"
          :items="personItems"
          :role-order="NOVEL_PERSON_ROLE_VALUES"
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
          :role-order="NOVEL_COMPANY_ROLE_VALUES"
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
              v-for="(site, index) in novel.externalSites"
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
      media-type="novel"
      :entity-id="novel.id"
    />
    <NovelInfoFormDialog
      v-if="editDialogs.details"
      v-model:open="editDialogs.details"
      :novel-id="novel.id"
    />
    <EntityTagsFormDialog
      v-if="editDialogs.tags"
      v-model:open="editDialogs.tags"
      entity-type="novel"
      :entity-id="novel.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.characters"
      v-model:open="editDialogs.characters"
      view="novel-characters"
      :entity-id="novel.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.persons"
      v-model:open="editDialogs.persons"
      view="novel-persons"
      :entity-id="novel.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.companies"
      v-model:open="editDialogs.companies"
      view="novel-companies"
      :entity-id="novel.id"
    />
    <EntityExternalSitesFormDialog
      v-if="editDialogs.externalSites"
      v-model:open="editDialogs.externalSites"
      entity-type="novel"
      :entity-id="novel.id"
    />
    <MediaRelationsFormDialog
      v-if="editDialogs.relations"
      v-model:open="editDialogs.relations"
      media-type="novel"
      :entity-id="novel.id"
    />

    <EntityDetailDialog v-model:target="openEntity" />
  </template>
</template>
