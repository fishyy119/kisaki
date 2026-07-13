<!-- Page header route navigation: ghost button pills highlighting the active route -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/utils/cn'
import type { PageHeaderNavItem } from './types'

interface Props {
  items: PageHeaderNavItem[]
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div
    data-slot="page-header-nav"
    :class="cn('flex items-center gap-1', props.class)"
  >
    <RouterLink
      v-for="item in props.items"
      :key="item.routeName"
      v-slot="{ navigate, isExactActive }"
      :to="{ name: item.routeName }"
      custom
    >
      <Button
        variant="ghost"
        size="sm"
        :class="{ 'bg-accent': isExactActive }"
        @click="navigate"
      >
        <Icon
          v-if="item.icon"
          :icon="item.icon"
          class="size-3.5"
        />
        {{ item.label }}
      </Button>
    </RouterLink>
  </div>
</template>
