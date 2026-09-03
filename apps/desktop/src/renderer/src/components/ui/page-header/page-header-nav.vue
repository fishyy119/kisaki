<!--
  Page header route navigation: ghost button pills highlighting the active
  route. With `collapseBelow`, once the header is narrower than that step the
  pills give way to one dropdown showing the active route - the same
  destinations, one control wide. Both renderings are in the markup and the
  header's container query picks one, so no width is measured in script.
  Routing stays with RouterLink's render-less form: this component never
  touches the router itself.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { RouterLink } from 'vue-router'
import type { ContainerStep } from '@renderer/components/ui/container'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { cn } from '@renderer/utils/cn'
import type { PageHeaderNavItem } from './types'

interface Props {
  items: PageHeaderNavItem[]
  /** Container step below which the pills collapse into one dropdown. */
  collapseBelow?: ContainerStep
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

/** Pills: shown at and above the step. */
const PILLS_CLASSES: Record<ContainerStep, string> = {
  sm: '@max-sm:hidden',
  md: '@max-md:hidden',
  lg: '@max-lg:hidden',
  xl: '@max-xl:hidden',
  '2xl': '@max-2xl:hidden',
  '3xl': '@max-3xl:hidden',
  '4xl': '@max-4xl:hidden',
  '5xl': '@max-5xl:hidden',
  '6xl': '@max-6xl:hidden',
  '7xl': '@max-7xl:hidden'
}

/** Dropdown: shown below the step. */
const DROPDOWN_CLASSES: Record<ContainerStep, string> = {
  sm: '@sm:hidden',
  md: '@md:hidden',
  lg: '@lg:hidden',
  xl: '@xl:hidden',
  '2xl': '@2xl:hidden',
  '3xl': '@3xl:hidden',
  '4xl': '@4xl:hidden',
  '5xl': '@5xl:hidden',
  '6xl': '@6xl:hidden',
  '7xl': '@7xl:hidden'
}
</script>

<template>
  <div
    data-slot="page-header-nav"
    :class="
      cn(
        'flex items-center gap-1',
        props.collapseBelow && PILLS_CLASSES[props.collapseBelow],
        props.class
      )
    "
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

  <div
    v-if="props.collapseBelow"
    data-slot="page-header-nav-collapsed"
    :class="cn('flex min-w-0 items-center', DROPDOWN_CLASSES[props.collapseBelow], props.class)"
  >
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="min-w-0"
        >
          <RouterLink
            v-for="item in props.items"
            :key="item.routeName"
            v-slot="{ isExactActive }"
            :to="{ name: item.routeName }"
            custom
          >
            <template v-if="isExactActive">
              <Icon
                v-if="item.icon"
                :icon="item.icon"
                class="size-3.5"
              />
              <span class="truncate">{{ item.label }}</span>
            </template>
          </RouterLink>
          <Icon
            icon="icon-[mdi--chevron-down]"
            class="size-3.5 text-muted-foreground"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <RouterLink
          v-for="item in props.items"
          :key="item.routeName"
          v-slot="{ navigate, isExactActive }"
          :to="{ name: item.routeName }"
          custom
        >
          <DropdownMenuItem
            :class="{ 'bg-accent': isExactActive }"
            @select="navigate()"
          >
            <Icon
              v-if="item.icon"
              :icon="item.icon"
              class="size-3.5"
            />
            {{ item.label }}
          </DropdownMenuItem>
        </RouterLink>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
