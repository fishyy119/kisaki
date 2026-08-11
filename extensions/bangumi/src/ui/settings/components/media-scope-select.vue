<!-- Picks the media scope a sync or import run targets. -->
<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@kisaki3/extension-ui-vue'
import type { BangumiMediaScope } from '../../../shared/scopes'
import type { BangumiScopeOption } from '../../../shared/settings'
import { m } from '../i18n'

interface Props {
  scopes: readonly BangumiScopeOption[]
  disabled?: boolean
}

const props = defineProps<Props>()
const scope = defineModel<BangumiMediaScope | undefined>({ required: true })
</script>

<template>
  <Select
    :model-value="scope ?? ''"
    :disabled="props.disabled || props.scopes.length < 2"
    @update:model-value="(value) => (scope = value as BangumiMediaScope)"
  >
    <SelectTrigger class="min-w-44">
      <SelectValue :placeholder="m.ui.mediaScopePlaceholder" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem
        v-for="option in props.scopes"
        :key="option.scope"
        :value="option.scope"
      >
        {{ option.label }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
