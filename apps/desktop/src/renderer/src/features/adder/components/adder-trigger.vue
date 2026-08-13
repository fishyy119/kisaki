<!--
  AdderTrigger
  Global adder trigger for sidebar with dropdown menu.
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
import type { ContentEntityType } from '@shared/common'
import EntityAdderDialog from './entity-adder-dialog.vue'

const { m } = useI18n()

const router = useRouter()
const adderEntityType = ref<ContentEntityType | null>(null)
const dropdownOpen = ref(false)

const adderOpen = computed({
  get: () => adderEntityType.value !== null,
  set: (value: boolean) => {
    if (!value) adderEntityType.value = null
  }
})

function handleAddEntity(entityType: ContentEntityType) {
  dropdownOpen.value = false
  adderEntityType.value = entityType
}

function handleAddGame() {
  handleAddEntity('game')
}

function handleAddAnime() {
  handleAddEntity('anime')
}

function handleAddCharacter() {
  handleAddEntity('character')
}

function handleAddPerson() {
  handleAddEntity('person')
}

function handleAddCompany() {
  handleAddEntity('company')
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
        {{ m.adder.trigger }}
      </TooltipContent>

      <DropdownMenuContent
        side="right"
        align="end"
        class="min-w-48"
      >
        <DropdownMenuItem
          class="gap-2"
          @select="handleAddGame"
        >
          <Icon
            :icon="getEntityIcon('game')"
            class="size-4"
          />
          <span>{{ m.library.detail.addEntity({ label: m.library.entities.game }) }}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          class="gap-2"
          @select="handleAddAnime"
        >
          <Icon
            :icon="getEntityIcon('anime')"
            class="size-4"
          />
          <span>{{ m.library.detail.addEntity({ label: m.library.entities.anime }) }}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          class="gap-2"
          @select="handleAddCharacter"
        >
          <Icon
            :icon="getEntityIcon('character')"
            class="size-4"
          />
          <span>{{ m.library.detail.addEntity({ label: m.library.entities.character }) }}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          class="gap-2"
          @select="handleAddPerson"
        >
          <Icon
            :icon="getEntityIcon('person')"
            class="size-4"
          />
          <span>{{ m.library.detail.addEntity({ label: m.library.entities.person }) }}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          class="gap-2"
          @select="handleAddCompany"
        >
          <Icon
            :icon="getEntityIcon('company')"
            class="size-4"
          />
          <span>{{ m.library.detail.addEntity({ label: m.library.entities.company }) }}</span>
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
          <span>{{ m.adder.addScanner }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </Tooltip>

  <EntityAdderDialog
    v-if="adderEntityType"
    v-model:open="adderOpen"
    :entity-type="adderEntityType"
  />
</template>
