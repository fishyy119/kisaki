<!--
  SearchInput
  Search field with a leading magnifier and a clear affordance. Keystrokes
  reach the model after a debounce; clearing commits at once. A model change
  from outside (a reset on scope switch) replaces the draft.
-->
<script setup lang="ts">
import { ref, watch, type HTMLAttributes } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@renderer/components/ui/input-group'
import { useDebouncedRef } from '@renderer/composables/use-debounced-ref'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'

interface Props {
  placeholder?: string
  /** Delay before typed text reaches the model. */
  debounce?: number
  /** Control size step; bands pass `sm`. */
  size?: 'default' | 'sm'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  debounce: 200,
  size: 'default'
})

const model = defineModel<string>({ required: true })

const { m } = useI18n()

const draft = ref(model.value)
const committedDraft = useDebouncedRef(draft, () => props.debounce)

watch(committedDraft, (value) => {
  if (value !== model.value) model.value = value
})

watch(model, (value) => {
  if (value !== draft.value) draft.value = value
})

function handleClear() {
  draft.value = ''
  model.value = ''
}
</script>

<template>
  <InputGroup
    :size="props.size"
    :class="cn('min-w-0', props.class)"
  >
    <InputGroupAddon>
      <Icon
        icon="icon-[mdi--magnify]"
        class="size-4"
      />
    </InputGroupAddon>
    <InputGroupInput
      v-model="draft"
      :placeholder="props.placeholder ?? m.values.searchPlaceholder"
    />
    <InputGroupAddon
      v-if="draft"
      align="inline-end"
      class="cursor-pointer"
      :title="m.actions.clear"
      @click="handleClear"
    >
      <Icon
        icon="icon-[mdi--close]"
        class="size-4 text-muted-foreground hover:text-foreground"
      />
    </InputGroupAddon>
  </InputGroup>
</template>
