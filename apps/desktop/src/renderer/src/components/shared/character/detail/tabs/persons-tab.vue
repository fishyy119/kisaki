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
import { PersonCard, PersonDetailDialog } from '@renderer/components/shared/person'
import { CharacterPersonsFormDialog } from '../../forms'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

// =============================================================================
// State
// =============================================================================

const { character, persons } = useCharacter()

const isEditOpen = ref(false)
const openPersonId = ref<string | null>(null)

// =============================================================================
// Constants
// =============================================================================

const PERSON_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.characterPerson
)

const PERSON_ROLE_ORDER = ['actor', 'illustration', 'designer', 'other'] as const

// =============================================================================
// Computed
// =============================================================================

const hasPersons = computed(() => persons.value.length > 0)

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

const personDialogOpen = computed({
  get: () => openPersonId.value !== null,
  set: (value) => {
    if (!value) openPersonId.value = null
  }
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
          v-for="role in PERSON_ROLE_ORDER"
          :key="role"
        >
          <div v-if="groupedPersons[role]?.length">
            <h4 class="text-xs font-medium text-muted-foreground mb-2">
              {{ PERSON_ROLE_LABELS[role] || role }}
            </h4>
            <div class="grid grid-cols-[repeat(auto-fill,6rem)] gap-3 justify-between">
              <template
                v-for="link in groupedPersons[role]"
                :key="link.id"
              >
                <PersonCard
                  v-if="link.person"
                  :person="link.person"
                  align="left"
                  size="sm"
                  @click="openPersonId = link.person.id"
                />
              </template>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- Edit Dialog -->
    <CharacterPersonsFormDialog
      v-if="isEditOpen"
      v-model:open="isEditOpen"
      :character-id="character.id"
    />

    <!-- Person Detail Dialog -->
    <PersonDetailDialog
      v-if="openPersonId"
      v-model:open="personDialogOpen"
      :person-id="openPersonId"
    />
  </template>
</template>
