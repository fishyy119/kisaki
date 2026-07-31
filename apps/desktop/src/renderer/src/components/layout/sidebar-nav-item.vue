<!--
  SidebarNavItem
  Individual navigation item with RouterLink and tooltip.
-->
<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { ExtensionIconInfo } from '@shared/extension'
import { Icon } from '@renderer/components/ui/icon'
import ContributionIcon from '@renderer/components/extension/contribution-icon.vue'
import { cn } from '@renderer/utils/cn'
import { Tooltip, TooltipTrigger, TooltipContent } from '@renderer/components/ui/tooltip'

interface NavItem {
  id: string
  label: string
  /** Static app icon class, or a resolved extension contribution icon. */
  icon: string | ExtensionIconInfo
  path: string
}

interface Props {
  item: NavItem
}

const props = defineProps<Props>()
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <RouterLink
        :to="props.item.path"
        :class="
          cn(
            'group relative flex items-center justify-center size-10 rounded-md transition-colors',
            'text-surface-foreground hover:text-accent-foreground hover:bg-accent',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary'
          )
        "
        active-class="text-accent-foreground bg-accent shadow-raised"
      >
        <!-- Active indicator -->
        <span
          class="absolute left-0 w-0.5 h-5 bg-primary rounded-r-full opacity-0 group-[.router-link-active]:opacity-100 transition-opacity"
        />
        <ContributionIcon
          v-if="typeof props.item.icon === 'object'"
          :icon="props.item.icon"
          class="size-5"
        />
        <Icon
          v-else
          :icon="props.item.icon"
          class="size-5"
        />
      </RouterLink>
    </TooltipTrigger>
    <TooltipContent
      side="right"
      :side-offset="8"
    >
      {{ props.item.label }}
    </TooltipContent>
  </Tooltip>
</template>
