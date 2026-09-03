<!--
  FilterDialog
  Dialog-based filter panel.
  Full-screen dialog version of FilterPanel. Header carries the title,
  condition count, and match mode; the body is the pure condition list; the
  footer groups list-level actions (add/clear) with cancel/confirm.
-->
<script setup lang="ts">
import type { FilterState } from '@shared/filter'
import { ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { createEmptyFilter, countConditions } from '@shared/filter'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Form } from '@renderer/components/ui/form'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/composables'
import FilterBuilder from './filter-builder.vue'
import MatchModeSwitch from './match-mode-switch.vue'
import AddConditionMenu from './add-condition-menu.vue'
import type { FilterUiSpec } from './specs/types'

interface Props {
  uiSpec: FilterUiSpec
}

const props = defineProps<Props>()
const { m } = useI18n()

const open = defineModel<boolean>('open', { required: true })
const filterModel = defineModel<FilterState>({ required: true })

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

// Local filter state - initialized in watch
const localFilter = ref<FilterState>(createEmptyFilter())

// Reset local filter when dialog opens (including initial)
watch(
  open,
  (isOpen) => {
    if (isOpen) {
      localFilter.value = filterModel.value
    }
  },
  { immediate: true }
)

function handleClear() {
  localFilter.value = createEmptyFilter()
}

function handleConfirm() {
  filterModel.value = localFilter.value
  emit('confirm')
  open.value = false
}

function handleCancel() {
  emit('cancel')
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <Form @submit="handleConfirm">
        <DialogHeader class="flex items-center gap-3">
          <DialogTitle class="flex items-center gap-2">
            <Icon
              icon="icon-[mdi--filter-outline]"
              class="size-4"
            />
            {{ m.filter.title }}
          </DialogTitle>
          <MatchModeSwitch v-model="localFilter" />
          <span
            v-if="countConditions(localFilter) > 0"
            class="text-xs font-normal text-muted-foreground"
          >
            {{ m.filter.conditionCount({ count: countConditions(localFilter) }) }}
          </span>
        </DialogHeader>

        <DialogBody class="max-h-[60vh]">
          <FilterBuilder
            v-model="localFilter"
            :ui-spec="props.uiSpec"
          />
        </DialogBody>

        <DialogFooter class="flex-row justify-between items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <AddConditionMenu
              v-model="localFilter"
              :ui-spec="props.uiSpec"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              @click="handleClear"
            >
              <Icon
                icon="icon-[mdi--filter-off-outline]"
                class="size-4 mr-1"
              />
              {{ m.filter.clearFilters }}
            </Button>
          </div>
          <div class="flex gap-2">
            <Button
              type="button"
              variant="outline"
              @click="handleCancel"
            >
              {{ m.actions.cancel }}
            </Button>
            <Button type="submit"> {{ m.actions.confirm }} </Button>
          </div>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
