<!--
Extension Header renders extension manager navigation and actions.
Boundary: emits commands and does not fetch extension data.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import {
  PageHeader,
  PageHeaderNav,
  PageHeaderTitle,
  type PageHeaderNavItem
} from '@renderer/components/ui/page-header'
import { useI18n } from '@renderer/composables/use-i18n'
import { EXTENSION_ROUTE_NAMES } from '../routes'

interface Props {
  reloadingExtensionHost?: boolean
  hasPendingReload?: boolean
  pendingReloadCount?: number
}

interface Emits {
  (e: 'openReleaseDialog'): void
  (e: 'reloadExtensionHost'): void
}

const props = withDefaults(defineProps<Props>(), {
  reloadingExtensionHost: false,
  hasPendingReload: false,
  pendingReloadCount: 0
})
const emit = defineEmits<Emits>()

const { m } = useI18n()

const showPendingIndicator = computed(() => props.hasPendingReload && !props.reloadingExtensionHost)
const reloadButtonTitle = computed(() =>
  props.hasPendingReload
    ? m.value.extension.header.reloadPending({ count: props.pendingReloadCount })
    : m.value.extension.header.reloadHost
)

const navItems = computed<PageHeaderNavItem[]>(() => [
  {
    routeName: EXTENSION_ROUTE_NAMES.discover,
    label: m.value.extension.nav.discover,
    icon: 'icon-[mdi--storefront-outline]'
  },
  {
    routeName: EXTENSION_ROUTE_NAMES.installed,
    label: m.value.extension.nav.installed,
    icon: 'icon-[mdi--check-circle-outline]'
  },
  {
    routeName: EXTENSION_ROUTE_NAMES.repositories,
    label: m.value.extension.nav.repositories,
    icon: 'icon-[mdi--source-branch]'
  },
  {
    routeName: EXTENSION_ROUTE_NAMES.signers,
    label: m.value.extension.nav.signers,
    icon: 'icon-[mdi--shield-key-outline]'
  }
])
</script>

<template>
  <PageHeader>
    <!-- Left: Title and sub-route navigation -->
    <PageHeaderTitle
      :title="m.extension.title"
      icon="icon-[mdi--puzzle-outline]"
    />
    <PageHeaderNav :items="navItems" />

    <!-- Right: Actions -->
    <template #actions>
      <Button
        variant="outline"
        size="sm"
        class="relative"
        :disabled="props.reloadingExtensionHost"
        :tooltip="reloadButtonTitle"
        @click="emit('reloadExtensionHost')"
      >
        <Icon
          :icon="props.reloadingExtensionHost ? 'icon-[mdi--loading]' : 'icon-[mdi--restart]'"
          :class="props.reloadingExtensionHost ? 'size-4 animate-spin' : 'size-4'"
        />
        {{ m.extension.header.reloadProcess }}
        <span
          v-if="showPendingIndicator"
          class="absolute -right-1 -top-1 size-2 rounded-full bg-warning ring-2 ring-surface"
        />
      </Button>

      <!-- Install extension button -->
      <Button
        variant="default"
        size="sm"
        @click="emit('openReleaseDialog')"
      >
        <Icon
          icon="icon-[mdi--plus]"
          class="size-4"
        />
        {{ m.extension.header.install }}
      </Button>
    </template>
  </PageHeader>
</template>
