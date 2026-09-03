<script setup lang="ts">
import type { AlertDialogDescriptionProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { AlertDialogDescription } from 'reka-ui'
import { cn } from '../../utils/cn'

const props = defineProps<AlertDialogDescriptionProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <AlertDialogDescription
    v-bind="delegatedProps"
    :class="
      cn(
        'min-h-0 overflow-y-auto px-4 py-3 text-sm wrap-break-word text-muted-foreground',
        props.class
      )
    "
    data-slot="alert-dialog-description"
  >
    <slot />
  </AlertDialogDescription>
</template>
