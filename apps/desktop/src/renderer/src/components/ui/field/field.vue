<!-- Field component with orientation variants -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@renderer/utils/cn'
import { Icon } from '@renderer/components/ui/icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import FieldDescription from './field-description.vue'
import FieldLabel from './field-label.vue'
import type { FieldHelp, FieldLink } from './types'

const fieldVariants = cva('group/field w-full gap-1.5 data-[invalid=true]:text-destructive', {
  variants: {
    orientation: {
      vertical: ['flex flex-col [&>*]:w-full [&>.sr-only]:w-auto'],
      horizontal: [
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5',
        '[&>.sr-only]:col-span-2 [&>.sr-only]:w-auto',
        '[&>[data-slot=field-header]]:col-start-1 [&>[data-slot=field-header]]:row-start-1',
        '[&>[data-slot=field-label]]:col-start-1 [&>[data-slot=field-label]]:row-start-1',
        '[&>[data-slot=field-description]]:col-start-1 [&>[data-slot=field-description]]:row-start-2',
        '[&>[data-slot=field-content]]:col-start-2 [&>[data-slot=field-content]]:row-start-1 [&>[data-slot=field-content]]:justify-self-end',
        'has-[>[data-slot=field-header]]:[&>[data-slot=field-content]]:self-center',
        'has-[>[data-slot=field-description]]:[&>[data-slot=field-content]]:row-span-2 has-[>[data-slot=field-description]]:[&>[data-slot=field-content]]:self-center',
        '[&>[role=checkbox],[role=radio],[role=switch]]:col-start-2 [&>[role=checkbox],[role=radio],[role=switch]]:row-start-1 [&>[role=checkbox],[role=radio],[role=switch]]:justify-self-end',
        'has-[>[data-slot=field-description]]:[&>[role=checkbox],[role=radio],[role=switch]]:row-span-2 has-[>[data-slot=field-description]]:[&>[role=checkbox],[role=radio],[role=switch]]:self-center'
      ],
      responsive: [
        'flex flex-col [&>*]:w-full [&>.sr-only]:w-auto',
        '@md:grid @md:grid-cols-[minmax(0,1fr)_auto] @md:items-center @md:gap-x-3 @md:gap-y-1 @md:[&>*]:w-auto',
        '@md:[&>.sr-only]:col-span-2 @md:[&>.sr-only]:w-auto',
        '@md:[&>[data-slot=field-header]]:col-start-1 @md:[&>[data-slot=field-header]]:row-start-1',
        '@md:[&>[data-slot=field-label]]:col-start-1 @md:[&>[data-slot=field-label]]:row-start-1',
        '@md:[&>[data-slot=field-description]]:col-start-1 @md:[&>[data-slot=field-description]]:row-start-2',
        '@md:[&>[data-slot=field-content]]:col-start-2 @md:[&>[data-slot=field-content]]:row-start-1 @md:[&>[data-slot=field-content]]:justify-self-end',
        '@md:has-[>[data-slot=field-header]]:[&>[data-slot=field-content]]:self-center',
        '@md:has-[>[data-slot=field-description]]:[&>[data-slot=field-content]]:row-span-2 @md:has-[>[data-slot=field-description]]:[&>[data-slot=field-content]]:self-center',
        '@md:[&>[role=checkbox],[role=radio],[role=switch]]:col-start-2 @md:[&>[role=checkbox],[role=radio],[role=switch]]:row-start-1 @md:[&>[role=checkbox],[role=radio],[role=switch]]:justify-self-end',
        '@md:has-[>[data-slot=field-description]]:[&>[role=checkbox],[role=radio],[role=switch]]:row-span-2 @md:has-[>[data-slot=field-description]]:[&>[role=checkbox],[role=radio],[role=switch]]:self-center'
      ]
    }
  },
  defaultVariants: {
    orientation: 'vertical'
  }
})

type FieldVariants = VariantProps<typeof fieldVariants>

interface Props {
  orientation?: FieldVariants['orientation']
  for?: string
  label?: string
  description?: string
  help?: FieldHelp
  link?: FieldLink
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'vertical'
})

const emit = defineEmits<{
  'link-click': [link: FieldLink]
}>()

const hasLabelRow = computed(() => Boolean(props.label || props.help || props.link))
const hasHeader = computed(() => Boolean(hasLabelRow.value || props.description))
const helpIcon = computed(() => props.help?.icon ?? 'icon-[mdi--information-outline]')
const helpLabel = computed(() => (props.label ? `${props.label} help` : 'Field help'))
const linkIcon = computed(() => props.link?.icon ?? 'icon-[mdi--open-in-new]')

function handleLinkClick(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()

  if (props.link) {
    emit('link-click', props.link)
  }
}
</script>

<template>
  <div
    role="group"
    data-slot="field"
    :data-orientation="props.orientation"
    :class="cn(fieldVariants({ orientation: props.orientation }), props.class)"
  >
    <div
      v-if="hasHeader"
      data-slot="field-header"
      class="min-w-0 space-y-1"
    >
      <div
        v-if="hasLabelRow"
        data-slot="field-label-row"
        class="flex min-w-0 items-center gap-1.5"
      >
        <FieldLabel
          v-if="props.label"
          :for="props.for"
          class="min-w-0"
        >
          {{ props.label }}
        </FieldLabel>

        <Tooltip v-if="props.help">
          <TooltipTrigger as-child>
            <span
              tabindex="0"
              class="inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary"
              :aria-label="helpLabel"
            >
              <Icon
                :icon="helpIcon"
                class="size-3.5"
              />
            </span>
          </TooltipTrigger>
          <TooltipContent class="max-w-xs whitespace-normal">
            {{ props.help.text }}
          </TooltipContent>
        </Tooltip>

        <Tooltip v-if="props.link">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-primary focus-visible:ring-1 focus-visible:ring-primary"
              :aria-label="props.link.label"
              @click="handleLinkClick"
            >
              <Icon
                :icon="linkIcon"
                class="size-3.5"
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>{{ props.link.label }}</TooltipContent>
        </Tooltip>
      </div>

      <FieldDescription v-if="props.description">
        {{ props.description }}
      </FieldDescription>
    </div>

    <slot />
  </div>
</template>
