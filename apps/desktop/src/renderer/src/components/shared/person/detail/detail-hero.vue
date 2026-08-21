<!--
  PersonDetailHero
  Hero section for person detail dialog.
  Shows photo and basic stats.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { CoverImage } from '@renderer/components/ui/cover-image'
import { usePerson } from '@renderer/composables/use-person'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { useI18n } from '@renderer/composables/use-i18n'
import { formatAliases, getEntityIcon } from '@renderer/utils/format'
import { Button } from '@renderer/components/ui/button'
import { PersonBasicFormDialog } from '../forms'

const GENDER_LABELS = computed<Record<string, string>>(() => m.value.library.gender)

const { person } = usePerson()
const { m, f } = useI18n()

const aliasesLine = computed(() => formatAliases(person.value?.aliases))

const isEditOpen = ref(false)
</script>

<template>
  <template v-if="person">
    <div class="flex gap-4 mb-4 group">
      <!-- Photo -->
      <CoverImage
        :src="
          person.photoFile
            ? getAttachmentUrl('persons', person.id, person.photoFile, { width: 200, height: 267 })
            : null
        "
        :alt="person.name"
        :icon="getEntityIcon('person')"
        class="w-24 aspect-[3/4] rounded-lg shrink-0 border shadow-raised"
      />

      <!-- Basic info -->
      <div class="flex-1 min-w-0 justify-between flex flex-col">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h2 class="text-lg font-semibold truncate">{{ person.name }}</h2>
            <p
              v-if="person.originalName"
              class="text-sm text-muted-foreground truncate"
            >
              {{ person.originalName }}
            </p>
            <p
              v-if="aliasesLine"
              class="text-xs text-muted-foreground/80 truncate"
            >
              {{ aliasesLine }}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            class="group-hover:opacity-100 opacity-0 transition-opacity text-muted-foreground"
            @click="isEditOpen = true"
          >
            <Icon
              icon="icon-[mdi--pencil-outline]"
              class="size-3.5"
            />
          </Button>
        </div>

        <!-- Stats grid -->
        <div class="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs">
          <div
            v-if="person.gender"
            class="flex gap-2"
          >
            <span class="text-muted-foreground">{{ m.library.fields.gender }}</span>
            <span>{{ GENDER_LABELS[person.gender] || person.gender }}</span>
          </div>
          <div
            v-if="person.birthDate"
            class="flex gap-2"
          >
            <span class="text-muted-foreground">{{ m.library.fields.birthDate }}</span>
            <span>{{ f.date(person.birthDate) }}</span>
          </div>
          <div
            v-if="person.deathDate"
            class="flex gap-2"
          >
            <span class="text-muted-foreground">{{ m.library.fields.deathDate }}</span>
            <span>{{ f.date(person.deathDate) }}</span>
          </div>
          <div
            v-if="person.score !== null"
            class="flex gap-2"
          >
            <span class="text-muted-foreground">{{ m.library.fields.score }}</span>
            <span class="text-warning">{{ (person.score / 10).toFixed(1) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Dialog -->
    <PersonBasicFormDialog
      v-if="isEditOpen"
      v-model:open="isEditOpen"
      :person-id="person.id"
    />
  </template>
</template>
