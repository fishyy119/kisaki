<!--
  Game Overview Tab

  Overview tab with 2:1 two-column layout.
  Left: Description, Characters (horizontal scroll), Tags
  Right: Details, Persons, Companies, Links
  Role-grouped sidebar lists clamp per role; "+N" jumps to the full tab.
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { useGame } from '@renderer/composables/use-game'
import { useI18n } from '@renderer/composables/use-i18n'
import { Section, SectionScroll } from '@renderer/components/ui/section'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { CharacterCard } from '@renderer/components/shared/character'
import {
  MediaRelationsFormDialog,
  MediaRelationsSection,
  MediaDescriptionFormDialog
} from '@renderer/components/shared/media'
import { TagCard } from '@renderer/components/shared/tag'
import { GameInfoFormDialog } from '../../forms'
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
  GAME_CHARACTER_ROLE_VALUES,
  GAME_COMPANY_ROLE_VALUES,
  GAME_PERSON_ROLE_VALUES
} from '@shared/db'
// =============================================================================
// Constants
// =============================================================================

const COMPANY_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.gameCompany
)

const PERSON_ROLE_LABELS = computed<Record<string, string>>(() => m.value.library.roles.gamePerson)

const CHARACTER_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.gameCharacter
)

// =============================================================================
// State
// =============================================================================

const { game, tags, characters, persons, companies, relations } = useGame()
const { m, f } = useI18n()

const emit = defineEmits<{
  /** Ask the host tab shell to switch to another detail tab. */
  navigate: [tab: 'persons' | 'companies']
}>()

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

/** The entity whose detail dialog is open, if any */
const openEntity = ref<EntityDetailTarget | null>(null)

// =============================================================================
// Computed
// =============================================================================

const aliases = computed(() => game.value?.aliases ?? [])
const hasExternalSites = computed(
  () => game.value?.externalSites && game.value.externalSites.length > 0
)
const hasTags = computed(() => tags.value && tags.value.length > 0)
const hasCharacters = computed(() => characters.value && characters.value.length > 0)

/** Sorted characters by type and order */
const sortedCharacters = computed(() => {
  if (!hasCharacters.value) return []
  return [...characters.value]
    .sort((a, b) => {
      const roleIndexA = GAME_CHARACTER_ROLE_VALUES.indexOf(
        (a.role || 'other') as (typeof GAME_CHARACTER_ROLE_VALUES)[number]
      )
      const roleIndexB = GAME_CHARACTER_ROLE_VALUES.indexOf(
        (b.role || 'other') as (typeof GAME_CHARACTER_ROLE_VALUES)[number]
      )
      if (roleIndexA !== roleIndexB) return roleIndexA - roleIndexB
      return a.orderInGame - b.orderInGame
    })
    .map((link) => ({
      link,
      character: link.character,
      roleLabel: link.role ? CHARACTER_ROLE_LABELS.value[link.role] : undefined
    }))
    .filter((item) => item.character !== null)
})

const personItems = computed<RoleLinkItem[]>(() =>
  persons.value.map((link) => ({ id: link.id, role: link.role, entity: link.person }))
)

const companyItems = computed<RoleLinkItem[]>(() =>
  companies.value.map((link) => ({ id: link.id, role: link.role, entity: link.company }))
)

// =============================================================================
// Helpers
// =============================================================================

function openEditDialog(dialog: keyof typeof editDialogs.value) {
  editDialogs.value[dialog] = true
}
</script>

<template>
  <template v-if="game">
    <div class="@container">
      <div class="grid grid-cols-1 gap-8 @3xl:grid-cols-[3fr_1fr]">
        <!-- Left column: Description, Characters, Tags -->
        <div class="space-y-6 min-w-0">
          <Section
            :title="m.library.detail.sections.description"
            editable
            :empty="!game.description"
            :empty-text="m.library.detail.empty.description"
            @edit="openEditDialog('description')"
          >
            <MarkdownContent :content="game.description!" />
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

        <!-- Right column: Details, Persons, Companies, Links -->
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
                  class="wrap-break-word"
                >
                  {{ alias }}
                </div>
              </dd>
              <dd v-else>{{ m.values.emptyValue }}</dd>
              <dt class="text-muted-foreground">{{ m.library.fields.releaseDate }}</dt>
              <dd>{{ game.releaseDate ? f.date(game.releaseDate) : m.values.emptyValue }}</dd>
              <dt class="text-muted-foreground">{{ m.library.fields.addedDate }}</dt>
              <dd>{{ game.createdAt ? f.date(game.createdAt) : m.values.emptyValue }}</dd>
            </dl>
          </Section>

          <EntityRoleLinksSection
            :title="m.library.detail.tabs.persons"
            :empty-text="m.library.detail.empty.persons"
            entity-type="person"
            :items="personItems"
            :role-order="GAME_PERSON_ROLE_VALUES"
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
            :role-order="GAME_COMPANY_ROLE_VALUES"
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
                v-for="(site, index) in game.externalSites"
                :key="index"
                :href="site.url"
                target="_blank"
                rel="noopener noreferrer"
                class="flex min-w-0 items-center gap-1 text-xs text-primary hover:underline"
              >
                <Icon
                  icon="icon-[mdi--open-in-new]"
                  class="size-3.5 shrink-0"
                />
                <span class="truncate">{{ site.label }}</span>
              </a>
            </div>
          </Section>
        </div>
      </div>
    </div>

    <!-- Edit Dialogs -->
    <MediaDescriptionFormDialog
      v-if="editDialogs.description"
      v-model:open="editDialogs.description"
      media-type="game"
      :entity-id="game.id"
    />
    <GameInfoFormDialog
      v-if="editDialogs.details"
      v-model:open="editDialogs.details"
      :game-id="game.id"
    />
    <EntityTagsFormDialog
      v-if="editDialogs.tags"
      v-model:open="editDialogs.tags"
      entity-type="game"
      :entity-id="game.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.characters"
      v-model:open="editDialogs.characters"
      view="game-characters"
      :entity-id="game.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.persons"
      v-model:open="editDialogs.persons"
      view="game-persons"
      :entity-id="game.id"
    />
    <EntityLinksFormDialog
      v-if="editDialogs.companies"
      v-model:open="editDialogs.companies"
      view="game-companies"
      :entity-id="game.id"
    />
    <EntityExternalSitesFormDialog
      v-if="editDialogs.externalSites"
      v-model:open="editDialogs.externalSites"
      entity-type="game"
      :entity-id="game.id"
    />
    <MediaRelationsFormDialog
      v-if="editDialogs.relations"
      v-model:open="editDialogs.relations"
      media-type="game"
      :entity-id="game.id"
    />

    <!-- Entity Detail Dialog -->
    <EntityDetailDialog v-model:target="openEntity" />
  </template>
</template>
