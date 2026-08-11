<!--
  AnimeDeleteFormDialog
  Delete confirmation dialog for anime with option to add to scanner ignore list.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { animes, settings } from '@shared/db'
import { DeleteRelatedOptions } from '@renderer/components/shared/entity-delete'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Label } from '@renderer/components/ui/label'
import { useAsyncData, useEntityDelete } from '@renderer/composables'
import { formatEntityDeleteSuccessMessage } from '@renderer/utils/entity-delete'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface Props {
  animeId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  deleted: [animeId: string]
}>()

interface InitialData {
  folderName: string
}

// Form state
const addToIgnored = ref(false)
const entityIds = computed(() => (props.animeId ? [props.animeId] : []))

const {
  data: deletePreview,
  isLoading: isDeletePreviewLoading,
  firstName,
  relatedOptions,
  selectedRelatedTypes,
  deleteSelectedEntities
} = useEntityDelete({
  entityType: 'anime',
  entityIds,
  open
})

// Fetch anime data when dialog opens
const { data, isLoading } = useAsyncData<InitialData>(
  async () => {
    const anime = await db.query.animes.findFirst({ where: eq(animes.id, props.animeId) })
    let folderName = ''
    if (anime?.animeDirPath) {
      const parts = anime.animeDirPath.replace(/\\/g, '/').split('/')
      folderName = parts[parts.length - 1] || ''
    }
    return {
      folderName
    }
  },
  {
    watch: [() => props.animeId],
    enabled: () => open.value
  }
)

// Reset form state when data loads
watch(data, () => {
  addToIgnored.value = false
})

const animeName = computed(() => firstName.value)
const folderName = computed(() => data.value?.folderName ?? '')

async function handleConfirm() {
  try {
    // Add to ignored names if checked
    if (addToIgnored.value && (folderName.value || animeName.value)) {
      const currentSettings = await db.query.settings.findFirst()
      const currentIgnoredNames = currentSettings?.scannerIgnoredNames || []
      const nameToIgnore = folderName.value || animeName.value

      if (!currentIgnoredNames.includes(nameToIgnore)) {
        await db
          .update(settings)
          .set({ scannerIgnoredNames: [...currentIgnoredNames, nameToIgnore] })
          .where(eq(settings.id, 0))
      }
    }

    const result = await deleteSelectedEntities()
    notify.success(formatEntityDeleteSuccessMessage(result))

    emit('deleted', props.animeId)
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
    :entity-label="m.library.entities.anime"
    :entity-name="firstName"
    :loading="isLoading || isDeletePreviewLoading || !data || !deletePreview"
    @confirm="handleConfirm"
  >
    <!-- Additional slot content for ignored checkbox -->
    <div
      v-if="animeName"
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
            : m.library.forms.addToScannerIgnoreName({ name: animeName })
        }}
      </Label>
    </div>

    <DeleteRelatedOptions
      v-model:selected-types="selectedRelatedTypes"
      :options="relatedOptions"
    />
  </DeleteConfirmDialog>
</template>
