<!--
  PersonCharactersTab
  Full grid of related characters grouped by role type.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { usePerson } from '@renderer/composables/use-person'
import { getEntityIcon } from '@renderer/utils/format'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { CharacterCard, CharacterDetailDialog } from '@renderer/components/shared/character'
import { PersonCharactersFormDialog } from '../../forms'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

const CHARACTER_PERSON_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.characterPerson
)

const CHARACTER_PERSON_ROLE_ORDER = ['actor', 'illustration', 'designer', 'other'] as const

const { person, characters } = usePerson()

const editDialogOpen = ref(false)
const openCharacterId = ref<string | null>(null)

const hasCharacters = computed(() => characters.value && characters.value.length > 0)

const groupedCharacters = computed(() => {
  if (!hasCharacters.value) return {}
  return characters.value.reduce(
    (acc, link) => {
      const role = link.role || 'other'
      if (!acc[role]) acc[role] = []
      acc[role].push(link)
      return acc
    },
    {} as Record<string, typeof characters.value>
  )
})

const characterDialogOpen = computed({
  get: () => openCharacterId.value !== null,
  set: (value) => {
    if (!value) openCharacterId.value = null
  }
})
</script>

<template>
  <template v-if="person">
    <!-- Empty state -->
    <StateView
      v-if="!hasCharacters"
      state="empty"
      :icon="getEntityIcon('character')"
      :description="m.library.detail.empty.relatedCharacters"
      class="py-12"
    >
      <template #actions>
        <Button
          variant="outline"
          size="sm"
          @click="editDialogOpen = true"
        >
          <Icon
            icon="icon-[mdi--plus]"
            class="size-4 mr-1.5"
          />
          {{ m.library.detail.addEntity({ label: m.library.entities.character }) }}
        </Button>
      </template>
    </StateView>

    <!-- Characters list -->
    <template v-else>
      <!-- Header with manage button -->
      <div class="flex items-center justify-start mb-4">
        <Button
          variant="outline"
          size="sm"
          @click="editDialogOpen = true"
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
          v-for="role in CHARACTER_PERSON_ROLE_ORDER"
          :key="role"
        >
          <div v-if="groupedCharacters[role]?.length">
            <h4 class="text-xs font-medium text-muted-foreground mb-2">
              {{ CHARACTER_PERSON_ROLE_LABELS[role] || role }}
            </h4>
            <div class="grid grid-cols-[repeat(auto-fill,6rem)] gap-3 justify-between">
              <template
                v-for="link in groupedCharacters[role]"
                :key="link.id"
              >
                <CharacterCard
                  v-if="link.character"
                  :character="link.character"
                  size="sm"
                  align="left"
                  @click="openCharacterId = link.character.id"
                />
              </template>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- Edit Dialog -->
    <PersonCharactersFormDialog
      v-if="editDialogOpen"
      v-model:open="editDialogOpen"
      :person-id="person.id"
    />

    <!-- Character Detail Dialog -->
    <CharacterDetailDialog
      v-if="openCharacterId"
      v-model:open="characterDialogOpen"
      :character-id="openCharacterId"
    />
  </template>
</template>
