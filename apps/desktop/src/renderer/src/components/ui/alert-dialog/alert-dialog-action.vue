<script setup lang="ts">
import type { AlertDialogActionProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { AlertDialogAction } from 'reka-ui'
import { buttonVariants } from '@renderer/components/ui/button'
import { cn } from '@renderer/utils'

const props = defineProps<
  AlertDialogActionProps & {
    class?: HTMLAttributes['class']
    disabled?: boolean
  }
>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <AlertDialogAction
    v-bind="delegatedProps"
    :class="cn(buttonVariants({ variant: 'destructive' }), props.class)"
    data-slot="alert-dialog-action"
  >
    <slot />
  </AlertDialogAction>
</template>
