<!--
  EntityExternalSitesFormDialog
  Dialog for editing an entity's related sites list stored on the entity row;
  entity differences arrive as the `entityType` registry key only.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { db, ENTITY_TABLES, updateEntityRows } from '@renderer/core/db'
import type { ExternalSite } from '@shared/db'
import { useLiveQuery } from '@renderer/composables'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
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
import { Button } from '@renderer/components/ui/button'
import { notify } from '@renderer/core/notify'
import { ListItem, ListItemActions } from '@renderer/components/ui/list-item'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'
import type { ContentEntityType } from '@shared/entity-types'
import EntityExternalSiteItemFormDialog from './external-site-item-form-dialog.vue'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  entityType: ContentEntityType
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const table = computed(() => ENTITY_TABLES[props.entityType].table)

// Form state
const sites = ref<ExternalSite[]>([])
const deleteIndex = ref<number | null>(null)
const formOpen = ref(false)
const editingIndex = ref<number | null>(null)
const isSaving = ref(false)

const { data: row, isLoading } = useLiveQuery(
  async () => {
    const rows = await db
      .select({ externalSites: table.value.externalSites })
      .from(table.value)
      .where(eq(table.value.id, props.entityId))
      .limit(1)
    return rows[0]
  },
  {
    watch: [() => props.entityId],
    enabled: () => open.value
  }
)

watch(row, (data) => {
  if (data) {
    sites.value = data.externalSites || []
  }
})

// Delete dialog state
const deleteDialogOpen = computed({
  get: () => deleteIndex.value !== null,
  set: (v) => {
    if (!v) deleteIndex.value = null
  }
})

const formInitialData = computed(() => {
  if (editingIndex.value === null) return undefined
  return sites.value[editingIndex.value]
})

async function handleSave() {
  isSaving.value = true
  try {
    const validSites = sites.value.filter((s) => s.label.trim() && s.url.trim())
    await updateEntityRows(props.entityType, [props.entityId], {
      externalSites: validSites.length > 0 ? validSites : null
    })

    notify.success(m.value.feedback.saved)
    open.value = false
  } catch (error) {
    log.error('Update failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}

function handleAddClick() {
  editingIndex.value = null
  formOpen.value = true
}

function handleEditClick(index: number) {
  editingIndex.value = index
  formOpen.value = true
}

function handleFormSubmit(data: ExternalSite) {
  if (editingIndex.value !== null) {
    sites.value[editingIndex.value] = data
  } else {
    sites.value.push(data)
  }
  formOpen.value = false
  editingIndex.value = null
}

function handleRemoveSite(index: number) {
  sites.value.splice(index, 1)
  deleteIndex.value = null
}

function handleMoveUp(index: number) {
  if (index <= 0) return
  const temp = sites.value[index - 1]!
  sites.value[index - 1] = sites.value[index]!
  sites.value[index] = temp
}

function handleMoveDown(index: number) {
  if (index >= sites.value.length - 1) return
  const temp = sites.value[index]!
  sites.value[index] = sites.value[index + 1]!
  sites.value[index + 1] = temp
}

function handleCancel() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <!-- Loading state -->
      <template v-if="isLoading || !row">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <!-- Form content -->
      <template v-else>
        <DialogHeader>
          <DialogTitle>{{ m.library.forms.editExternalSites }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="max-h-[60vh]">
          <div class="space-y-1">
            <StateView
              v-if="sites.length === 0"
              state="empty"
              :description="
                m.library.forms.emptyListHint({ label: m.library.forms.linkLabels.link })
              "
              class="py-8"
            />
            <ListItem
              v-for="(site, index) in sites"
              v-else
              :key="index"
              icon="icon-[mdi--link-variant]"
              :title="site.label"
              :description="site.url"
            >
              <template #actions>
                <ListItemActions
                  movable
                  :is-first="index === 0"
                  :is-last="index === sites.length - 1"
                  @move-up="handleMoveUp(index)"
                  @move-down="handleMoveDown(index)"
                  @edit="handleEditClick(index)"
                  @delete="deleteIndex = index"
                />
              </template>
            </ListItem>
          </div>
        </DialogBody>
        <DialogFooter class="flex justify-between">
          <Button
            variant="outline"
            @click="handleAddClick"
          >
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4 mr-1.5"
            />
            {{ m.library.forms.addLink }}
          </Button>
          <div class="flex gap-2">
            <Button
              variant="outline"
              @click="handleCancel"
            >
              {{ m.actions.cancel }}
            </Button>
            <Button
              :disabled="isSaving"
              @click="handleSave"
            >
              {{ m.actions.save }}
            </Button>
          </div>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- Site form dialog -->
  <EntityExternalSiteItemFormDialog
    v-if="formOpen"
    v-model:open="formOpen"
    :initial-data="formInitialData"
    @submit="handleFormSubmit"
  />

  <!-- Delete confirmation dialog -->
  <AlertDialog v-model:open="deleteDialogOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ m.library.forms.deleteLinkConfirmTitle }}</AlertDialogTitle>
      </AlertDialogHeader>
      <AlertDialogDescription>{{
        m.library.forms.deleteLinkConfirmDescription
      }}</AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ m.actions.cancel }}</AlertDialogCancel>
        <AlertDialogAction @click="deleteIndex !== null && handleRemoveSite(deleteIndex)">
          {{ m.actions.delete }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
