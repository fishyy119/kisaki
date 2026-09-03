<!-- Content language selector: picks a media metadata language (scraper lookups). -->
<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { CONTENT_LOCALES, languageAutonym, type ContentLocale } from '@shared/i18n'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@renderer/components/ui/select'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'

interface Props {
  allowEmpty?: boolean
  /** Label of the empty choice; defaults to "not specified". */
  placeholder?: string
  class?: HTMLAttributes['class']
  triggerClass?: HTMLAttributes['class']
  size?: 'default' | 'sm'
}

const props = withDefaults(defineProps<Props>(), {
  allowEmpty: true,
  placeholder: undefined,
  size: 'default'
})

const model = defineModel<ContentLocale | null>({ default: null })

const { m } = useI18n()

const emptyLabel = computed(() => props.placeholder ?? m.value.states.notSpecified)

const EMPTY_VALUE = '__empty__'

const selectValue = computed({
  get: () => model.value ?? EMPTY_VALUE,
  set: (value) => {
    model.value = value === EMPTY_VALUE ? null : (value as ContentLocale)
  }
})

const options = computed(() => CONTENT_LOCALES.map((tag) => ({ tag, label: languageAutonym(tag) })))

const displayValue = computed(() => {
  if (!model.value) return null
  return props.size === 'sm' ? model.value : `${languageAutonym(model.value)} (${model.value})`
})
</script>

<template>
  <Select v-model="selectValue">
    <SelectTrigger
      :size="props.size"
      :class="cn('w-auto min-w-20', props.triggerClass, props.class)"
    >
      <span
        v-if="displayValue"
        class="truncate"
        >{{ displayValue }}</span
      >
      <span
        v-else
        class="text-muted-foreground"
        >{{ emptyLabel }}</span
      >
    </SelectTrigger>
    <SelectContent>
      <SelectItem
        v-if="props.allowEmpty"
        :value="EMPTY_VALUE"
        class="text-muted-foreground"
      >
        {{ emptyLabel }}
      </SelectItem>
      <SelectItem
        v-for="option in options"
        :key="option.tag"
        :value="option.tag"
      >
        {{ option.label }} ({{ option.tag }})
      </SelectItem>
    </SelectContent>
  </Select>
</template>
