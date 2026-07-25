<!-- UI language selector: picks the interface language, with a follow-system option. -->
<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { UI_LOCALES, languageAutonym, type UiLocale } from '@shared/i18n'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@renderer/components/ui/select'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'

interface Props {
  class?: HTMLAttributes['class']
  triggerClass?: HTMLAttributes['class']
  size?: 'default' | 'sm'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default'
})

/** null selects follow-system. */
const model = defineModel<UiLocale | null>({ default: null })

const { m } = useI18n()

const SYSTEM_VALUE = '__system__'

const selectValue = computed({
  get: () => model.value ?? SYSTEM_VALUE,
  set: (value) => {
    model.value = value === SYSTEM_VALUE ? null : (value as UiLocale)
  }
})

const options = computed(() => UI_LOCALES.map((tag) => ({ tag, label: languageAutonym(tag) })))

const displayValue = computed(() => {
  if (!model.value) return m.value.settings.language.followSystem
  return languageAutonym(model.value)
})
</script>

<template>
  <Select v-model="selectValue">
    <SelectTrigger
      :size="props.size"
      :class="cn('w-auto min-w-32', props.triggerClass, props.class)"
    >
      <span class="truncate">{{ displayValue }}</span>
    </SelectTrigger>
    <SelectContent>
      <SelectItem :value="SYSTEM_VALUE">
        {{ m.settings.language.followSystem }}
      </SelectItem>
      <SelectItem
        v-for="option in options"
        :key="option.tag"
        :value="option.tag"
      >
        {{ option.label }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>
