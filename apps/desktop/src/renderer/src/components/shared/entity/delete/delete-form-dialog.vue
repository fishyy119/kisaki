<!--
  EntityDeleteFormDialog
  Delete confirmation dialog for a single entity of any type. Media entities
  additionally offer adding the entry's folder/name to the scanner ignore
  list so the deleted entry does not get re-imported.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { animes, games, settings } from '@shared/db'
import type { AllEntityType } from '@shared/common'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Label } from '@renderer/components/ui/label'
import { useAsyncData, useEntityDelete } from '@renderer/composables'
import { formatEntityDeleteSuccessMessage } from '@renderer/utils/entity-delete'
import { useI18n } from '@renderer/composables/use-i18n'
import DeleteRelatedOptions from './delete-related-options.vue'

const { m } = useI18n()

interface Props {
  entityType: AllEntityType
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  deleted: [entityId: string]
}>()

/** Folder-name readers for entities backed by scanner-synced directories. */
const SCANNER_IGNORE_SOURCES: Partial<Record<AllEntityType, (id: string) => Promise<string>>> = {
  game: async (id) => {
    const game = await db.query.games.findFirst({ where: eq(games.id, id) })
    return folderNameOf(game?.gameDirPath)
  },
  anime: async (id) => {
    const anime = await db.query.animes.findFirst({ where: eq(animes.id, id) })
    return folderNameOf(anime?.animeDirPath)
  }
}

function folderNameOf(dirPath: string | null | undefined): string {
  if (!dirPath) return ''
  const parts = dirPath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || ''
}

const ignoreSource = computed(() => SCANNER_IGNORE_SOURCES[props.entityType])

// Form state
const addToIgnored = ref(false)
const entityIds = computed(() => (props.entityId ? [props.entityId] : []))

const {
  data: deletePreview,
  isLoading: isDeletePreviewLoading,
  firstName,
  relatedOptions,
  selectedRelatedTypes,
  deleteSelectedEntities
} = useEntityDelete({
  entityType: () => props.entityType,
  entityIds,
  open
})

// Fetch the scanner folder name when the entity supports ignoring
const { data: folderData, isLoading: isFolderLoading } = useAsyncData(
  async () => {
    const source = ignoreSource.value
    return { folderName: source ? await source(props.entityId) : '' }
  },
  {
    watch: [() => props.entityId],
    enabled: () => open.value
  }
)

watch(folderData, () => {
  addToIgnored.value = false
})

const folderName = computed(() => folderData.value?.folderName ?? '')

async function handleConfirm() {
  try {
    if (ignoreSource.value && addToIgnored.value && (folderName.value || firstName.value)) {
      const currentSettings = await db.query.settings.findFirst()
      const currentIgnoredNames = currentSettings?.scannerIgnoredNames || []
      const nameToIgnore = folderName.value || firstName.value

      if (!currentIgnoredNames.includes(nameToIgnore)) {
        await db
          .update(settings)
          .set({ scannerIgnoredNames: [...currentIgnoredNames, nameToIgnore] })
          .where(eq(settings.id, 0))
      }
    }

    const result = await deleteSelectedEntities()
    notify.success(formatEntityDeleteSuccessMessage(result))

    emit('deleted', props.entityId)
  } catch (error) {
    notify.error(
      m.value.library.feedback.deleteFailedWithReason({ message: (error as Error).message })
    )
  }
}
</script>

<template>
  <DeleteConfirmDialog
    v-model:open="open"
    :entity-label="m.library.entities[props.entityType]"
    :entity-name="firstName"
    :loading="isDeletePreviewLoading || !deletePreview || (!!ignoreSource && isFolderLoading)"
    @confirm="handleConfirm"
  >
    <!-- Scanner ignore option for directory-synced media -->
    <div
      v-if="ignoreSource && firstName"
      class="flex items-center gap-2"
    >
      <Checkbox
        id="add-to-ignored"
        v-model="addToIgnored"
      />
      <Label
        for="add-to-ignored"
        class="text-sm font-normal cursor-pointer"
      >
        {{
          folderName
            ? m.library.forms.addToScannerIgnoreFolder({ name: folderName })
            : m.library.forms.addToScannerIgnoreName({ name: firstName })
        }}
      </Label>
    </div>

    <DeleteRelatedOptions
      v-model:selected-types="selectedRelatedTypes"
      :options="relatedOptions"
    />
  </DeleteConfirmDialog>
</template>
