<!--
Editing surface of one reading mark: its note, its color, and removing it.
Boundary: shared by every mark list, so a mark is revised the same way whatever
kind it is; the list owns persistence.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Textarea } from '@renderer/components/ui/textarea'
import { useI18n } from '@renderer/composables/use-i18n'
import { HIGHLIGHT_COLORS, HIGHLIGHT_TINTS } from '@renderer/core/reader/text/highlight'
import { cn } from '@renderer/utils/cn'
import type { HighlightColor } from '@shared/db/contracts/enums'

const props = defineProps<{
  note: string | null
  /** Current color; absent for marks that carry none, which hides the palette. */
  color?: HighlightColor
}>()

const emit = defineEmits<{
  updateNote: [note: string | null]
  updateColor: [color: HighlightColor]
  remove: []
}>()

const { m } = useI18n()

const open = ref(false)
const draft = ref('')

watch(open, (value) => {
  if (value) draft.value = props.note ?? ''
})

function commitNote(): void {
  const next = draft.value.trim()
  emit('updateNote', next === '' ? null : next)
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon-xs"
        :tooltip="m.reader.marks.edit"
      >
        <Icon
          icon="icon-[mdi--dots-horizontal]"
          class="size-3.5"
        />
      </Button>
    </PopoverTrigger>
    <!-- A quick action surface, not a settings form: the swatches and the note
         field speak for themselves, so neither carries a label. -->
    <PopoverContent
      align="end"
      class="w-60 space-y-2 p-3"
    >
      <div
        v-if="props.color"
        class="flex items-center gap-1.5"
      >
        <button
          v-for="option in HIGHLIGHT_COLORS"
          :key="option"
          type="button"
          :aria-label="m.reader.marks.color"
          :class="
            cn(
              'size-5 rounded-full transition-opacity',
              props.color === option
                ? 'ring-1 ring-primary ring-offset-1 ring-offset-popover'
                : 'hover:opacity-75'
            )
          "
          :style="{ backgroundColor: HIGHLIGHT_TINTS[option] }"
          @click="emit('updateColor', option)"
        />
      </div>

      <Textarea
        v-model="draft"
        :placeholder="m.reader.marks.notePlaceholder"
        class="min-h-14 text-xs"
        @keydown.enter.exact.prevent="commitNote"
      />

      <div class="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          class="text-destructive hover:text-destructive"
          @click="emit('remove')"
        >
          {{ m.reader.marks.remove }}
        </Button>
        <Button
          size="sm"
          @click="commitNote"
        >
          {{ m.reader.marks.saveNote }}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
