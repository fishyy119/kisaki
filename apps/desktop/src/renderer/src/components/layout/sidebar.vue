<!--
  Sidebar
  Desktop-style sidebar navigation with icon buttons.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/utils/cn'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator
} from '@renderer/components/ui/dropdown-menu'
import { Tooltip, TooltipTrigger, TooltipContent } from '@renderer/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { usePreferencesStore, useThemeStore } from '@renderer/stores'
import {
  extensionContributionStore,
  getExtensionPagePath,
  resolveExtensionText
} from '@renderer/core/extensions'
import type { ExtensionIconInfo } from '@shared/extension'
import SidebarNavItem from './sidebar-nav-item.vue'
import { AdderTrigger } from '@renderer/features/adder'
import { ScraperProfilesFormDialog } from '@renderer/features/scraper'
import { SettingsFormDialog } from '@renderer/features/settings'
import { AboutDialog } from '@renderer/features/about'
import { TaskCenterTrigger } from '@renderer/features/task-center'
import { useI18n } from '@renderer/composables/use-i18n'

interface NavItem {
  id: string
  label: string
  icon: string | ExtensionIconInfo
  path: string
}

const { m } = useI18n()

const navItems = computed<NavItem[]>(() => [
  { id: 'library', label: m.value.nav.library, icon: 'icon-[mdi--bookshelf]', path: '/library' },
  {
    id: 'statistics',
    label: m.value.nav.statistics,
    icon: 'icon-[mdi--chart-box-outline]',
    path: '/statistics'
  },
  {
    id: 'scanner',
    label: m.value.nav.scanner,
    icon: 'icon-[mdi--folder-search-outline]',
    path: '/scanner'
  },
  {
    id: 'automation',
    label: m.value.nav.automation,
    icon: 'icon-[mdi--timer-outline]',
    path: '/automation'
  },
  {
    id: 'extension',
    label: m.value.nav.extension,
    icon: 'icon-[mdi--puzzle-outline]',
    path: '/extension'
  }
])

// Nav-enabled webview pages declared by extensions, rendered after the app
// items. The snapshot arrives sorted by nav order; disabled or uninstalled
// extensions disappear with their snapshot entries.
const extensionNavItems = computed<NavItem[]>(() =>
  extensionContributionStore.webviewPages.value.flatMap((page) => {
    if (!page.nav || !page.icon) {
      return []
    }

    return [
      {
        id: `extension-page:${page.extensionId}:${page.pageId}`,
        label: resolveExtensionText(page.title),
        icon: page.icon,
        path: getExtensionPagePath(page.extensionId, page.pageId)
      }
    ]
  })
)

const isSettingsOpen = ref(false)
const isProfileManagerOpen = ref(false)
const isAboutOpen = ref(false)

// Preferences
const preferencesStore = usePreferencesStore()
const { showNsfw } = storeToRefs(preferencesStore)

// Theme mode (light/dark/system lives in sidebar dropdown)
const themeStore = useThemeStore()
const { mode } = storeToRefs(themeStore)

const isNsfwConfirmOpen = ref(false)
const pendingShowNsfw = ref<boolean | null>(null)

watch(isNsfwConfirmOpen, (open) => {
  if (open) return
  pendingShowNsfw.value = null
})

function handleNsfwConfirm() {
  if (pendingShowNsfw.value === null) return
  preferencesStore.setShowNsfw(pendingShowNsfw.value)
  isNsfwConfirmOpen.value = false
}

const showNsfwModel = computed({
  get: () => showNsfw.value,
  set: (checked: boolean | undefined) => {
    if (checked === undefined) return
    if (checked === showNsfw.value) return

    pendingShowNsfw.value = checked
    isNsfwConfirmOpen.value = true
  }
})
</script>

<template>
  <aside class="flex flex-col h-full w-13 bg-surface border-r border-border shrink-0">
    <!-- Main navigation -->
    <nav class="flex-1 flex flex-col items-center py-2 gap-1">
      <SidebarNavItem
        v-for="item in navItems"
        :key="item.id"
        :item="item"
      />
      <SidebarNavItem
        v-for="item in extensionNavItems"
        :key="item.id"
        :item="item"
      />
    </nav>

    <!-- Bottom navigation -->
    <nav class="flex flex-col items-center py-2 gap-1">
      <AdderTrigger />
      <TaskCenterTrigger />

      <!-- Settings Dropdown -->
      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger as-child>
            <DropdownMenuTrigger as-child>
              <button
                :class="
                  cn(
                    'flex items-center justify-center size-10 rounded-md transition-colors',
                    'text-surface-foreground hover:text-accent-foreground hover:bg-accent',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary'
                  )
                "
              >
                <Icon
                  icon="icon-[mdi--cog-outline]"
                  class="size-5"
                />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            :side-offset="8"
          >
            {{ m.nav.settings }}
          </TooltipContent>

          <DropdownMenuContent
            side="right"
            align="end"
            :side-offset="8"
            class="min-w-48"
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Icon
                  icon="icon-[mdi--weather-sunset]"
                  class="size-4"
                />
                <span>{{ m.nav.themeMode }}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                side="right"
                align="start"
                class="min-w-40"
              >
                <DropdownMenuRadioGroup v-model="mode">
                  <DropdownMenuRadioItem value="light">
                    <Icon
                      icon="icon-[mdi--weather-sunny]"
                      class="size-4"
                    />
                    <span>{{ m.nav.themeLight }}</span>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Icon
                      icon="icon-[mdi--weather-night]"
                      class="size-4"
                    />
                    <span>{{ m.nav.themeDark }}</span>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Icon
                      icon="icon-[mdi--laptop]"
                      class="size-4"
                    />
                    <span>{{ m.nav.themeSystem }}</span>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuCheckboxItem v-model="showNsfwModel">
              <Icon
                icon="icon-[mdi--coffee-outline]"
                class="size-4"
              />
              <span>{{ m.nav.showNsfw }}</span>
            </DropdownMenuCheckboxItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem @select="isProfileManagerOpen = true">
              <Icon
                icon="icon-[mdi--database-cog-outline]"
                class="size-4"
              />
              <span>{{ m.nav.scraperProfiles }}</span>
            </DropdownMenuItem>

            <DropdownMenuItem @select="isSettingsOpen = true">
              <Icon
                icon="icon-[mdi--power-settings-new]"
                class="size-4"
              />
              <span>{{ m.nav.appSettings }}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem @select="isAboutOpen = true">
              <Icon
                icon="icon-[mdi--information-outline]"
                class="size-4"
              />
              <span>{{ m.nav.about }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>
    </nav>
  </aside>

  <!-- Profile Manager Dialog -->
  <ScraperProfilesFormDialog
    v-if="isProfileManagerOpen"
    v-model:open="isProfileManagerOpen"
  />

  <SettingsFormDialog
    v-if="isSettingsOpen"
    v-model:open="isSettingsOpen"
  />

  <AboutDialog
    v-if="isAboutOpen"
    v-model:open="isAboutOpen"
  />

  <AlertDialog v-model:open="isNsfwConfirmOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ pendingShowNsfw ? m.nav.nsfw.enableTitle : m.nav.nsfw.disableTitle }}
        </AlertDialogTitle>
      </AlertDialogHeader>
      <AlertDialogDescription>
        <p v-if="pendingShowNsfw">{{ m.nav.nsfw.enableDescription }}</p>
        <p v-else>{{ m.nav.nsfw.disableDescription }}</p>
      </AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ m.common.cancel }}</AlertDialogCancel>
        <AlertDialogAction @click="handleNsfwConfirm">{{ m.common.confirm }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
