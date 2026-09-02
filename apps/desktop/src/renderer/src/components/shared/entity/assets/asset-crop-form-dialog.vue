<!--
  AssetCropFormDialog
  Dialog for cropping an entity's image asset with the slot's crop
  constraints; writes the cropped result back to the same slot.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { attachment } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import {
  ImageCropperDialog,
  type CropConfirmPayload
} from '@renderer/components/ui/image-cropper-dialog'
import { useI18n } from '@renderer/composables/use-i18n'
import type { ContentEntityType } from '@shared/entity-types'
import { ENTITY_ASSET_SPECS } from './asset-specs'

const { m } = useI18n()

interface Props {
  entityType: ContentEntityType
  entityId: string
  slotType: string
  currentFileName: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const spec = computed(() => ENTITY_ASSET_SPECS[props.entityType])
const slot = computed(() => spec.value.slots.find((s) => s.type === props.slotType)!)

const isCropping = ref(false)

const imageSrc = computed(
  () => `attachment://${spec.value.attachmentTable}/${props.entityId}/${props.currentFileName}`
)
const dialogTitle = computed(() =>
  m.value.library.forms.cropMediaTitle({ label: slot.value.label(m.value) })
)

async function handleConfirm(payload: CropConfirmPayload) {
  isCropping.value = true

  try {
    const sourcePath = await attachment.getPath(
      spec.value.attachmentTable,
      props.entityId,
      props.currentFileName
    )

    const croppedResult = await ipcManager.invoke(
      'image:crop-to-temp',
      { kind: 'path', path: sourcePath },
      payload.pixels,
      { format: 'keep' }
    )
    if (!croppedResult.success) {
      notify.error(m.value.library.forms.cropFailed, croppedResult.error)
      return
    }

    await spec.value.setFile(props.entityId, props.slotType, {
      kind: 'path',
      path: croppedResult.data
    })

    notify.success(m.value.library.forms.mediaUpdated)
    open.value = false
  } catch (error) {
    notify.error(m.value.library.forms.cropFailed, (error as Error).message)
  } finally {
    isCropping.value = false
  }
}
</script>

<template>
  <ImageCropperDialog
    v-model:open="open"
    :src="imageSrc"
    :title="dialogTitle"
    :aspect-ratio="slot.cropAspect"
    :aspect-label="slot.cropAspectLabel"
    :loading="isCropping"
    @confirm="handleConfirm"
  />
</template>
