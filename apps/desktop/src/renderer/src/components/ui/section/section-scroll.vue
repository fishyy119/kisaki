<!--
  SectionScroll - Section with a virtualized horizontal card row.

  Owns the scroll wiring: prev/next buttons in the header and a
  VirtualHorizontalScroll body. Shows the Section emptyText when there
  are no items. The title slot passes through for callers that style it.
-->
<script setup lang="ts" generic="T">
import { ref, type HTMLAttributes } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { VirtualHorizontalScroll } from '@renderer/components/ui/virtual'
import Section from './section.vue'

interface Props {
  title?: string
  editable?: boolean
  items: T[]
  getKey?: (item: T, index: number) => string | number
  emptyText?: string
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const emit = defineEmits<{
  edit: []
}>()

defineSlots<{
  title?: () => void
  item: (props: { item: T; index: number }) => void
}>()

const scrollRef = ref<{ scrollLeft: () => void; scrollRight: () => void } | null>(null)
const scrollState = ref({ canScrollLeft: false, canScrollRight: false })
</script>

<template>
  <Section
    :title="props.title"
    :editable="props.editable"
    :empty="props.items.length === 0"
    :empty-text="props.emptyText"
    :class="props.class"
    data-slot="section-scroll"
    @edit="emit('edit')"
  >
    <template
      v-if="$slots.title"
      #title
    >
      <slot name="title" />
    </template>

    <template
      v-if="props.items.length > 0"
      #actions
    >
      <Button
        variant="ghost"
        size="icon-sm"
        class="size-6"
        :disabled="!scrollState.canScrollLeft"
        @click="scrollRef?.scrollLeft()"
      >
        <Icon
          icon="icon-[mdi--chevron-left]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="size-6"
        :disabled="!scrollState.canScrollRight"
        @click="scrollRef?.scrollRight()"
      >
        <Icon
          icon="icon-[mdi--chevron-right]"
          class="size-4"
        />
      </Button>
    </template>

    <VirtualHorizontalScroll
      ref="scrollRef"
      :items="props.items"
      :get-key="props.getKey"
      class="flex gap-3 pr-0.5"
      @scroll-state-change="scrollState = $event"
    >
      <template #item="scope">
        <slot
          name="item"
          v-bind="scope"
        />
      </template>
    </VirtualHorizontalScroll>
  </Section>
</template>
