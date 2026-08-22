<!--
  PersonDetailHero

  Hero section for the person detail view: photo plus identity (name, original
  name) and the personal score, each editable on hover. Person attributes such
  as gender, dates, and aliases live in the overview tab's details section.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { CoverImage } from '@renderer/components/ui/cover-image'
import { usePerson } from '@renderer/composables/use-person'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { useI18n } from '@renderer/composables/use-i18n'
import { dbScoreToDisplay, getEntityIcon } from '@renderer/utils/format'
import { Button } from '@renderer/components/ui/button'
import {
  EntityNameFormDialog,
  EntityOriginalNameFormDialog,
  EntityScoreFormDialog
} from '@renderer/components/shared/entity'

const { person } = usePerson()
const { m } = useI18n()

const editDialogs = ref({
  name: false,
  originalName: false,
  score: false
})

function openEditDialog(dialog: keyof typeof editDialogs.value) {
  editDialogs.value[dialog] = true
}

const photoUrl = computed(() =>
  person.value?.photoFile
    ? getAttachmentUrl('persons', person.value.id, person.value.photoFile, {
        width: 200,
        height: 267
      })
    : null
)
</script>

<template>
  <template v-if="person">
    <div class="flex gap-4 mb-4">
      <CoverImage
        :src="photoUrl"
        :alt="person.name"
        :icon="getEntityIcon('person')"
        class="w-24 aspect-[3/4] rounded-lg shrink-0 border shadow-raised"
      />

      <div class="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <!-- Name (Editable) -->
          <div class="group/field relative flex items-center gap-3">
            <h2 class="text-lg font-semibold truncate">{{ person.name }}</h2>
            <Button
              variant="ghost"
              size="icon-xs"
              class="opacity-0 group-hover/field:opacity-100 transition-opacity p-0.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent focus:opacity-100 focus:outline-none"
              :aria-label="m.common.edit"
              @click="openEditDialog('name')"
            >
              <Icon
                icon="icon-[mdi--pencil-outline]"
                class="size-3"
              />
            </Button>
          </div>

          <!-- Original Name (Editable) -->
          <div class="group/field relative flex items-center gap-3 mt-1">
            <p class="text-sm text-muted-foreground truncate">
              {{ person.originalName || person.name }}
            </p>
            <Button
              variant="ghost"
              size="icon-xs"
              class="opacity-0 group-hover/field:opacity-100 transition-opacity p-0.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent focus:opacity-100 focus:outline-none"
              :aria-label="m.common.edit"
              @click="openEditDialog('originalName')"
            >
              <Icon
                icon="icon-[mdi--pencil-outline]"
                class="size-3"
              />
            </Button>
          </div>
        </div>

        <div class="grid grid-cols-[auto_1fr] gap-3 items-center text-sm">
          <span class="flex items-center gap-1.5 text-muted-foreground">
            <button
              class="group/icon size-4 relative cursor-pointer"
              :aria-label="m.common.edit"
              @click="openEditDialog('score')"
            >
              <Icon
                icon="icon-[mdi--starburst-outline]"
                class="size-4 absolute inset-0 transition-opacity group-hover/icon:opacity-0"
              />
              <Icon
                icon="icon-[mdi--pencil-outline]"
                class="size-4 absolute inset-0 opacity-0 transition-opacity group-hover/icon:opacity-100"
              />
            </button>
            <span class="text-xs">{{ m.library.fields.myScore }}</span>
          </span>
          <span class="font-medium truncate text-xs">
            {{ person.score !== null ? dbScoreToDisplay(person.score) : m.common.emptyValue }}
          </span>
        </div>
      </div>
    </div>

    <!-- Edit Dialogs - conditionally rendered -->
    <EntityNameFormDialog
      v-if="editDialogs.name"
      v-model:open="editDialogs.name"
      entity-type="person"
      :entity-id="person.id"
    />
    <EntityOriginalNameFormDialog
      v-if="editDialogs.originalName"
      v-model:open="editDialogs.originalName"
      entity-type="person"
      :entity-id="person.id"
    />
    <EntityScoreFormDialog
      v-if="editDialogs.score"
      v-model:open="editDialogs.score"
      entity-type="person"
      :entity-id="person.id"
    />
  </template>
</template>
