<!--
  SortControl
  Sort field and direction as one control. The default form is a button
  group: a field select beside a direction toggle, so the current sort reads
  at a glance. The compact form folds both into one icon-triggered menu for
  narrow rails. An option that is an order of its own (membership, a manual
  arrangement) declares `directionFixed`: selecting it pins the direction to
  ascending and disables the toggle.
-->
<script setup lang="ts" generic="TField extends string = string">
import { computed, watch, type HTMLAttributes } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { ButtonGroup } from '@renderer/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'
import type { SortDirection } from '@shared/filter'
import type { SortOption } from './types'

interface Props {
  options: readonly SortOption<TField>[]
  /** One icon trigger opening a menu, for rails too narrow for the group. */
  compact?: boolean
  /** Control size step; bands pass `sm`, forms keep the default. */
  size?: 'default' | 'sm'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  size: 'default'
})

const field = defineModel<TField>('field', { required: true })
const direction = defineModel<SortDirection>('direction', { required: true })

const { m } = useI18n()

const buttonSize = computed(() => (props.size === 'sm' ? 'icon-sm' : 'icon'))

/** Whether the selected option carries its own order; travels with the option. */
const isDirectionFixed = computed(
  () => props.options.find((option) => option.value === field.value)?.directionFixed ?? false
)

// A fixed-direction field has exactly one honest direction; snapping keeps
// what consumers persist canonical (ascending), never a stale descending.
watch(
  isDirectionFixed,
  (fixed) => {
    if (fixed && direction.value !== 'asc') direction.value = 'asc'
  },
  { immediate: true }
)

const directionIcon = computed(() =>
  direction.value === 'asc' ? 'icon-[mdi--sort-ascending]' : 'icon-[mdi--sort-descending]'
)

/** A disabled toggle explains itself instead of naming a direction it ignores. */
const directionTooltip = computed(() => {
  if (isDirectionFixed.value) return m.value.sorting.directionFixed
  return direction.value === 'asc' ? m.value.sorting.ascending : m.value.sorting.descending
})

function handleToggleDirection() {
  direction.value = direction.value === 'asc' ? 'desc' : 'asc'
}
</script>

<template>
  <DropdownMenu v-if="props.compact">
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        :size="buttonSize"
        :class="cn('text-muted-foreground', props.class)"
        :title="m.actions.sort"
      >
        <Icon
          :icon="directionIcon"
          class="size-4"
        />
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      align="end"
      class="min-w-40"
    >
      <DropdownMenuRadioGroup v-model="field">
        <DropdownMenuRadioItem
          v-for="option in props.options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>

      <DropdownMenuSeparator />

      <DropdownMenuRadioGroup v-model="direction">
        <DropdownMenuRadioItem
          value="asc"
          :disabled="isDirectionFixed"
        >
          {{ m.sorting.ascending }}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem
          value="desc"
          :disabled="isDirectionFixed"
        >
          {{ m.sorting.descending }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>

  <ButtonGroup
    v-else
    :class="cn('shrink-0', props.class)"
  >
    <!-- The group divider is the select's right border, so it never fades
         with the toggle's disabled state; min-w keeps the field switch from
         resizing the band. -->
    <Select v-model="field">
      <SelectTrigger
        :size="props.size"
        class="min-w-32 flex-1 focus:border-border"
        :title="m.actions.sort"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="option in props.options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </SelectItem>
      </SelectContent>
    </Select>
    <!-- Disabled dims the icon only: fading the whole button would fade the
         group frame with it. bg-input matches the select half of the group. -->
    <Button
      variant="outline"
      :size="buttonSize"
      class="bg-input text-muted-foreground aria-disabled:opacity-100 aria-disabled:text-muted-foreground/40"
      :disabled="isDirectionFixed"
      :tooltip="directionTooltip"
      @click="handleToggleDirection"
    >
      <Icon
        :icon="directionIcon"
        class="size-4"
      />
    </Button>
  </ButtonGroup>
</template>
