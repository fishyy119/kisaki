<!--
  CharacterPersonsTab
  Persons tab content for character detail dialog.
  Shows full list of related persons by type.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { useCharacter } from '@renderer/composables/use-character'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { VirtualGrid } from '@renderer/components/ui/virtual'
import { PersonCard } from '@renderer/components/shared/person'
import { useI18n } from '@renderer/composables'
import {
  EntityDetailDialog,
  EntityLinksFormDialog,
  type EntityDetailTarget
} from '@renderer/components/shared/entity'
import { CHARACTER_PERSON_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()

// =============================================================================
// State
// =============================================================================

const { character, persons } = useCharacter()

const isEditOpen = ref(false)
const openEntity = ref<EntityDetailTarget | null>(null)

// =============================================================================
// Constants
// =============================================================================

const PERSON_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.characterPerson
)

// =============================================================================
// Computed
// =============================================================================

const hasPersons = computed(() => persons.value.length > 0)

const groupedPersons = computed(() => {
  return persons.value.reduce(
    (acc, link) => {
      // A link whose person row is hidden or gone renders nothing
      if (!link.person) return acc
      const role = link.role || 'other'
      if (!acc[role]) acc[role] = []
      acc[role].push(link)
      return acc
    },
    {} as Record<string, typeof persons.value>
  )
})
</script>

<template>
  <template v-if="character">
    <!-- Empty state -->
    <StateView
      v-if="!hasPersons"
      state="empty"
      icon="icon-[mdi--microphone-outline]"
      :description="m.library.detail.empty.relatedPersons"
      class="py-12"
    >
      <template #actions>
        <Button
          variant="outline"
          size="sm"
          @click="isEditOpen = true"
        >
          <Icon
            icon="icon-[mdi--plus]"
            class="size-4 mr-1.5"
          />
          {{ m.library.detail.addEntity({ label: m.library.entities.person }) }}
        </Button>
      </template>
    </StateView>

    <!-- Content state -->
    <template v-else>
      <!-- Header with manage button -->
      <div class="flex items-center justify-start mb-4">
        <Button
          variant="outline"
          size="sm"
          @click="isEditOpen = true"
        >
          <Icon
            icon="icon-[mdi--pencil-outline]"
            class="size-4 mr-1.5"
          />
          {{ m.library.detail.manage }}
        </Button>
      </div>

      <div class="space-y-4">
        <template
          v-for="role in CHARACTER_PERSON_ROLE_VALUES"
          :key="role"
        >
          <div v-if="groupedPersons[role]?.length">
            <h4 class="text-xs font-medium text-muted-foreground mb-2">
              {{ PERSON_ROLE_LABELS[role] || role }}
            </h4>
            <!-- A popular character can carry hundreds of person links -->
            <VirtualGrid
              :items="groupedPersons[role]!"
              :get-key="(link) => link.id"
              scroll="region"
              class="grid grid-cols-[repeat(auto-fill,6rem)] gap-3 justify-between"
            >
              <template #item="{ item: link }">
                <PersonCard
                  :person="link.person!"
                  align="left"
                  size="sm"
                  @click="openEntity = { entityType: 'person', entityId: link.person!.id }"
                />
              </template>
            </VirtualGrid>
          </div>
        </template>
      </div>
    </template>

    <!-- Edit Dialog -->
    <EntityLinksFormDialog
      v-if="isEditOpen"
      v-model:open="isEditOpen"
      view="character-persons"
      :entity-id="character.id"
    />

    <!-- Person Detail Dialog -->
    <EntityDetailDialog v-model:target="openEntity" />
  </template>
</template>
