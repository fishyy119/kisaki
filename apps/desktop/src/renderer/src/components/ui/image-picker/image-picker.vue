<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { cn } from '@renderer/utils/cn'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { useI18n } from '@renderer/composables/use-i18n'

interface Props {
  class?: HTMLAttributes['class']
  imageUrl?: string | null
  imageAlt?: string
  pickedPath?: string | null
  /** Preview of the picked file; shown instead of the picked path text. */
  pickedPreviewUrl?: string | null
  pickedPathPrefix?: string
  pickLabel?: string
  pickIcon?: string
  clearLabel?: string
  pickDisabled?: boolean
  clearDisabled?: boolean
  previewMaxHeightClass?: string
  showPickedPath?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  imageUrl: null,
  imageAlt: '',
  pickedPath: null,
  pickedPreviewUrl: null,
  pickIcon: 'icon-[mdi--image-outline]',
  pickDisabled: false,
  clearDisabled: false,
  previewMaxHeightClass: 'max-h-64',
  showPickedPath: true
})

const { m } = useI18n()

const pickedPathPrefixText = computed(() => props.pickedPathPrefix ?? m.value.ui.imagePicker.picked)
const pickLabelText = computed(() => props.pickLabel ?? m.value.ui.imagePicker.pick)
const clearLabelText = computed(() => props.clearLabel ?? m.value.ui.imagePicker.clear)

const emit = defineEmits<{
  pick: []
  clear: []
}>()

function handlePick() {
  emit('pick')
}

function handleClear() {
  emit('clear')
}
</script>

<template>
  <div
    :class="cn('space-y-2', props.class)"
    data-slot="image-picker"
  >
    <div
      v-if="props.imageUrl || props.pickedPreviewUrl"
      class="rounded-lg overflow-hidden border bg-muted"
    >
      <img
        :src="props.imageUrl ?? props.pickedPreviewUrl ?? undefined"
        :alt="props.imageAlt"
        :class="cn('w-full object-contain', props.previewMaxHeightClass)"
      />
    </div>

    <div
      v-else-if="props.showPickedPath && props.pickedPath"
      class="text-xs text-muted-foreground border rounded-md p-2"
    >
      {{ pickedPathPrefixText }}{{ props.pickedPath }}
    </div>

    <div class="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        :disabled="props.pickDisabled"
        @click="handlePick"
      >
        <Icon
          :icon="props.pickIcon"
          class="size-4 mr-1.5"
        />
        {{ pickLabelText }}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        :disabled="props.clearDisabled"
        @click="handleClear"
      >
        {{ clearLabelText }}
      </Button>

      <slot name="actions" />
    </div>
  </div>
</template>
