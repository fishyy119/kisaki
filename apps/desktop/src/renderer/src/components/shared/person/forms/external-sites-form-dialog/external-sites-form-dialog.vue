<!--
  PersonExternalSitesFormDialog
  Dialog for editing person related sites/links.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db } from '@renderer/core/db'
import { persons } from '@shared/db'
import { useAsyncData } from '@renderer/composables'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { Button } from '@renderer/components/ui/button'
import { notify } from '@renderer/core/notify'
import { ListItem, ListItemActions } from '@renderer/components/ui/list-item'
import PersonExternalSitesItemFormDialog from './external-site-item-form-dialog.vue'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Person')

interface Props {
  personId: string
}

interface ExternalSite {
  label: string
  url: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

// Form state
const sites = ref<ExternalSite[]>([])
const deleteIndex = ref<number | null>(null)
const formOpen = ref(false)
const editingIndex = ref<number | null>(null)
const isSaving = ref(false)

// Fetch person data when dialog opens
const { data: person, isLoading } = useAsyncData(
  () => db.query.persons.findFirst({ where: eq(persons.id, props.personId) }),
  {
    watch: [() => props.personId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(person, (personData) => {
  if (personData) {
    sites.value = personData.externalSites || []
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
    await db
      .update(persons)
      .set({ externalSites: validSites.length > 0 ? validSites : null })
      .where(eq(persons.id, props.personId))

    notify.success(m.value.common.saved)
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

function handleRemoveSite() {
  if (deleteIndex.value !== null) {
    sites.value.splice(deleteIndex.value, 1)
    deleteIndex.value = null
  }
}

function handleMoveUp(index: number) {
  if (index <= 0) return
  const temp = sites.value[index - 1]
  sites.value[index - 1] = sites.value[index]
  sites.value[index] = temp
}

function handleMoveDown(index: number) {
  if (index >= sites.value.length - 1) return
  const temp = sites.value[index]
  sites.value[index] = sites.value[index + 1]
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
      <template v-if="isLoading || !person">
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
        <DialogBody class="overflow-auto max-h-[60vh]">
          <div class="space-y-1">
            <p
              v-if="sites.length === 0"
              class="text-sm text-muted-foreground text-center py-8"
            >
              {{ m.library.forms.emptyListHint({ label: m.library.forms.linkLabels.link }) }}
            </p>
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
              {{ m.common.cancel }}
            </Button>
            <Button
              :disabled="isSaving"
              @click="handleSave"
            >
              {{ m.common.save }}
            </Button>
          </div>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- Site form dialog -->
  <PersonExternalSitesItemFormDialog
    v-if="formOpen"
    v-model:open="formOpen"
    :initial-data="formInitialData"
    @submit="handleFormSubmit"
  />

  <!-- Delete confirmation dialog -->
  <DeleteConfirmDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-label="m.library.forms.linkLabels.link"
    @confirm="handleRemoveSite"
  />
</template>
