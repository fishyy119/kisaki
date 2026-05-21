<!--
Extension Header renders extension manager navigation and actions.
Boundary: emits commands and does not fetch extension data.
-->
<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/utils'

interface Props {
  checkingUpdates?: boolean
  updatingAll?: boolean
  updateCount?: number
  automaticUpdateCount?: number
}

interface Emits {
  (e: 'checkUpdates'): void
  (e: 'updateAll'): void
  (e: 'openInstallDialog'): void
}

const props = withDefaults(defineProps<Props>(), {
  checkingUpdates: false,
  updatingAll: false,
  updateCount: 0,
  automaticUpdateCount: 0
})
const emit = defineEmits<Emits>()

const route = useRoute()

const navItems: {
  routeName:
    | 'extension-discover'
    | 'extension-installed'
    | 'extension-repositories'
    | 'extension-signers'
  label: string
  icon: string
}[] = [
  { routeName: 'extension-discover', label: '发现', icon: 'icon-[mdi--storefront-outline]' },
  { routeName: 'extension-installed', label: '已安装', icon: 'icon-[mdi--check-circle-outline]' },
  { routeName: 'extension-repositories', label: '仓库', icon: 'icon-[mdi--source-branch]' },
  { routeName: 'extension-signers', label: '签名', icon: 'icon-[mdi--shield-key-outline]' }
]

function isRouteActive(routeName: string): boolean {
  const currentRouteName = route.name
  if (!currentRouteName || typeof currentRouteName !== 'string')
    return routeName === 'extension-discover'
  return currentRouteName === routeName
}
</script>

<template>
  <div class="shrink-0 flex items-center gap-3 px-4 h-12 border-b border-border bg-surface">
    <!-- Left: Title and sub-route navigation -->
    <div class="flex items-center gap-4 shrink-0">
      <div class="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          as-child
        >
          <RouterLink to="/library">
            <Icon
              icon="icon-[mdi--arrow-left]"
              class="size-4"
            />
          </RouterLink>
        </Button>
        <Icon
          icon="icon-[mdi--puzzle-outline]"
          class="size-5"
        />
        <h1 class="text-base font-semibold">扩展</h1>
      </div>

      <!-- Sub-route navigation -->
      <div class="flex items-center gap-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.routeName"
          v-slot="{ navigate }"
          :to="{ name: item.routeName }"
          custom
        >
          <Button
            variant="ghost"
            size="sm"
            :class="{ 'bg-accent': isRouteActive(item.routeName) }"
            @click="navigate"
          >
            <span class="flex items-center gap-1.5 relative">
              <Icon
                :icon="item.icon"
                class="size-3.5"
              />
              <span>{{ item.label }}</span>
              <span
                v-if="item.routeName === 'extension-installed' && props.updateCount > 0"
                class="absolute -top-1 -right-3 size-4 flex items-center justify-center text-[10px] font-medium bg-primary text-primary-foreground rounded-full"
              >
                {{ props.updateCount }}
              </span>
            </span>
          </Button>
        </RouterLink>
      </div>
    </div>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Right: Actions -->
    <div class="flex items-center gap-2 shrink-0">
      <!-- Check updates - only show on installed page -->
      <Button
        v-if="isRouteActive('extension-installed')"
        variant="ghost"
        size="sm"
        :disabled="props.checkingUpdates || props.updatingAll"
        @click="emit('checkUpdates')"
      >
        <Icon
          icon="icon-[mdi--refresh]"
          :class="cn('size-4', props.checkingUpdates && 'animate-spin')"
        />
        检查更新
      </Button>

      <Button
        v-if="isRouteActive('extension-installed') && props.updateCount > 0"
        variant="secondary"
        size="sm"
        :disabled="props.updatingAll || props.automaticUpdateCount === 0"
        @click="emit('updateAll')"
      >
        <Icon
          icon="icon-[mdi--update]"
          :class="cn('size-4', props.updatingAll && 'animate-spin')"
        />
        自动更新
        <span
          v-if="props.automaticUpdateCount > 0"
          class="ml-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] text-primary-foreground"
        >
          {{ props.automaticUpdateCount }}
        </span>
      </Button>

      <!-- Install extension button -->
      <Button
        variant="default"
        size="sm"
        class="text-xs gap-1.5"
        @click="emit('openInstallDialog')"
      >
        <Icon
          icon="icon-[mdi--plus]"
          class="size-4"
        />
        安装扩展
      </Button>
    </div>
  </div>
</template>
