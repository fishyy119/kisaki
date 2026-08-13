<script setup lang="ts">
import { Primitive } from 'reka-ui'
import { createReusableTemplate } from '@vueuse/core'
import { cn } from '@renderer/utils/cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { buttonVariants } from './variants'
import type { ButtonProps } from './types'

// Multi-root template (DefineButton + tooltip branch) disables automatic
// attr fallthrough, so attrs are bound to the Primitive explicitly.
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<ButtonProps>(), {
  as: 'button'
})

const [DefineButton, ReuseButton] = createReusableTemplate()
</script>

<template>
  <DefineButton>
    <!-- Native buttons default to type="button" so form-embedded action
         buttons never submit implicitly; explicit type attrs still win. -->
    <Primitive
      :type="as === 'button' && !asChild ? 'button' : undefined"
      v-bind="$attrs"
      data-slot="button"
      :as="as"
      :as-child="asChild"
      :class="cn(buttonVariants({ variant, size }), props.class)"
    >
      <slot />
    </Primitive>
  </DefineButton>

  <Tooltip v-if="props.tooltip">
    <TooltipTrigger as-child>
      <ReuseButton />
    </TooltipTrigger>
    <TooltipContent>{{ props.tooltip }}</TooltipContent>
  </Tooltip>
  <ReuseButton v-else />
</template>
