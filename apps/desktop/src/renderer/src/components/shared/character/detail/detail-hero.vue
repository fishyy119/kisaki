<!--
  Character Detail Hero

  Hero section for character detail page.
  Shows photo and basic stats with editable button.
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { CoverImage } from '@renderer/components/ui/cover-image'
import { useCharacter } from '@renderer/composables/use-character'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { useI18n } from '@renderer/composables/use-i18n'
import { formatAliases, getEntityIcon } from '@renderer/utils/format'
import { Button } from '@renderer/components/ui/button'
import { CharacterBasicFormDialog } from '../forms'

// =============================================================================
// State
// =============================================================================

const { character } = useCharacter()
const { m, f } = useI18n()

const isEditOpen = ref(false)

// =============================================================================
// Constants
// =============================================================================

const aliasesLine = computed(() => formatAliases(character.value?.aliases))

const GENDER_LABELS = computed<Record<string, string>>(() => m.value.library.gender)

const BLOOD_TYPE_LABELS = computed<Record<string, string>>(() => m.value.library.bloodType)

const CUP_SIZE_LABELS: Record<string, string> = {
  aaa: 'AAA',
  aa: 'AA',
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
  e: 'E',
  f: 'F',
  g: 'G',
  h: 'H',
  i: 'I',
  j: 'J',
  k: 'K'
}

// =============================================================================
// Helpers
// =============================================================================

function getBodyStats() {
  if (!character.value) return null
  const c = character.value
  const parts = []

  if (c.height !== null) parts.push(`${c.height}cm`)
  if (c.weight !== null) parts.push(`${c.weight}kg`)
  if (c.bust !== null || c.waist !== null || c.hips !== null) {
    parts.push(`B${c.bust ?? '?'}-W${c.waist ?? '?'}-H${c.hips ?? '?'}`)
  }
  if (c.cup) parts.push(CUP_SIZE_LABELS[c.cup] || c.cup.toUpperCase())

  return parts.length > 0 ? parts.join(' / ') : null
}
</script>

<template>
  <template v-if="character">
    <div class="flex gap-4 mb-4 group">
      <!-- Photo -->
      <CoverImage
        :src="
          character.photoFile
            ? getAttachmentUrl('characters', character.id, character.photoFile, {
                width: 300,
                height: 400
              })
            : null
        "
        :alt="character.name"
        :icon="getEntityIcon('character')"
        class="w-24 aspect-[3/4] rounded-lg shrink-0 border shadow-raised"
      />

      <!-- Basic info -->
      <div class="flex-1 min-w-0 justify-between flex flex-col">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h2 class="text-lg font-semibold truncate">{{ character.name }}</h2>
            <p
              v-if="character.originalName"
              class="text-sm text-muted-foreground truncate"
            >
              {{ character.originalName }}
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
            v-if="character.gender"
            class="flex gap-2"
          >
            <span class="text-muted-foreground">{{ m.library.fields.gender }}</span>
            <span>{{ GENDER_LABELS[character.gender] || character.gender }}</span>
          </div>
          <div
            v-if="character.birthDate"
            class="flex gap-2"
          >
            <span class="text-muted-foreground">{{ m.library.fields.birthDate }}</span>
            <span>{{ f.date(character.birthDate) }}</span>
          </div>
          <div
            v-if="character.age !== null"
            class="flex gap-2"
          >
            <span class="text-muted-foreground">{{ m.library.fields.age }}</span>
            <span>{{ m.library.detail.ageValue({ age: character.age }) }}</span>
          </div>
          <div
            v-if="character.bloodType"
            class="flex gap-2"
          >
            <span class="text-muted-foreground">{{ m.library.fields.bloodType }}</span>
            <span>{{ BLOOD_TYPE_LABELS[character.bloodType] || character.bloodType }}</span>
          </div>
          <div
            v-if="getBodyStats()"
            class="flex gap-2 col-span-2"
          >
            <span class="text-muted-foreground">{{ m.library.fields.measurements }}</span>
            <span>{{ getBodyStats() }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Dialog - conditionally rendered -->
    <CharacterBasicFormDialog
      v-if="isEditOpen"
      v-model:open="isEditOpen"
      :character-id="character.id"
    />
  </template>
</template>
