<!--
  EnumEditor
  Multi-toggle pill value editor for enum conditions (value is string[]).
-->
<script setup lang="ts">
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/utils/cn'
import type { FilterUiOption } from '../specs/types'

interface Props {
  options: FilterUiOption[]
}

const props = defineProps<Props>()
const model = defineModel<string[]>({ required: true })

function handleToggle(value: string) {
  model.value = model.value.includes(value)
    ? model.value.filter((entry) => entry !== value)
    : [...model.value, value]
}
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <Button
      v-for="option in props.options"
      :key="option.value"
      type="button"
      variant="secondary"
      size="xs"
      :class="
        cn(
          model.includes(option.value)
            ? 'bg-accent text-accent-foreground hover:bg-accent/80 border-accent'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )
      "
      @click="() => handleToggle(option.value)"
    >
      {{ option.label }}
    </Button>
  </div>
</template>
