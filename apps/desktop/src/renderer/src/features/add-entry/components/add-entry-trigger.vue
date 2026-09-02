<!--
  AddEntryTrigger
  Global add-entry trigger for the sidebar, with a dropdown menu.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@renderer/composables/use-i18n'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/utils/cn'
import { getEntityIcon } from '@renderer/utils/format'
import { Tooltip, TooltipTrigger, TooltipContent } from '@renderer/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/entity-types'
import AddEntryDialog from './add-entry-dialog.vue'

const { m } = useI18n()

const router = useRouter()
const addEntryType = ref<ContentEntityType | null>(null)
const dropdownOpen = ref(false)

const addEntryOpen = computed({
  get: () => addEntryType.value !== null,
  set: (value: boolean) => {
    if (!value) addEntryType.value = null
  }
})

function handleAddEntity(entityType: ContentEntityType) {
  dropdownOpen.value = false
  addEntryType.value = entityType
}

function handleAddScanner() {
  dropdownOpen.value = false
  router.push('/scanner')
}
</script>

<template>
  <Tooltip>
    <DropdownMenu v-model:open="dropdownOpen">
      <TooltipTrigger as-child>
        <DropdownMenuTrigger as-child>
          <button
            :class="
              cn(
                'group relative flex items-center justify-center size-10 rounded-md transition-colors',
                'text-surface-foreground hover:text-accent-foreground hover:bg-accent',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary'
              )
            "
          >
            <Icon
              icon="icon-[mdi--plus]"
              class="size-5"
            />
          </button>
        </DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        :side-offset="8"
      >
        {{ m.addEntry.trigger }}
      </TooltipContent>

      <DropdownMenuContent
        side="right"
        align="end"
        class="min-w-48"
      >
        <DropdownMenuItem
          v-for="entityType in CONTENT_ENTITY_TYPES"
          :key="entityType"
          class="gap-2"
          @select="handleAddEntity(entityType)"
        >
          <Icon
            :icon="getEntityIcon(entityType)"
            class="size-4"
          />
          <span>{{ m.library.detail.addEntity({ label: m.library.entities[entityType] }) }}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          class="gap-2"
          @select="handleAddScanner"
        >
          <Icon
            icon="icon-[mdi--folder-plus-outline]"
            class="size-4"
          />
          <span>{{ m.addEntry.addScanner }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </Tooltip>

  <AddEntryDialog
    v-if="addEntryType"
    v-model:open="addEntryOpen"
    :entity-type="addEntryType"
  />
</template>
