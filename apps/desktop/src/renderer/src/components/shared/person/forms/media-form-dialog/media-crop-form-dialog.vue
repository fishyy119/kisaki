<!--
  PersonMediaCropFormDialog
  Dialog for cropping person photo image.
  Uses the reusable ImageCropperDialog component.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { attachment } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { persons } from '@shared/db'
import {
  ImageCropperDialog,
  type CropConfirmPayload
} from '@renderer/components/ui/image-cropper-dialog'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

type PersonMediaType = 'photo'

interface Props {
  personId: string
  mediaType: PersonMediaType
  currentFileName: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const isCropping = ref(false)

const imageSrc = computed(() => `attachment://persons/${props.personId}/${props.currentFileName}`)
const MEDIA_TYPE_LABEL = computed<Record<PersonMediaType, string>>(() => ({
  photo: m.value.library.forms.mediaTypes.photo
}))
const MEDIA_TYPE_TO_ASPECT: Record<PersonMediaType, number | undefined> = {
  photo: 3 / 4
}
const MEDIA_TYPE_TO_ASPECT_LABEL: Record<PersonMediaType, string | undefined> = {
  photo: '3:4'
}

const dialogTitle = computed(() =>
  m.value.library.forms.cropMediaTitle({ label: MEDIA_TYPE_LABEL.value[props.mediaType] })
)
const aspectRatio = computed(() => MEDIA_TYPE_TO_ASPECT[props.mediaType])
const aspectLabel = computed(() => MEDIA_TYPE_TO_ASPECT_LABEL[props.mediaType])

async function handleConfirm(payload: CropConfirmPayload) {
  isCropping.value = true

  try {
    const sourcePath = await attachment.getPath('persons', props.personId, props.currentFileName)

    const croppedResult = await ipcManager.invoke(
      'attachment:crop-to-temp',
      { kind: 'path', path: sourcePath },
      payload.pixels,
      { format: 'keep' }
    )
    if (!croppedResult.success) {
      notify.error(m.value.library.forms.cropFailed, croppedResult.error)
      return
    }

    await attachment.setFile(persons, props.personId, 'photoFile', {
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
    :aspect-ratio="aspectRatio"
    :aspect-label="aspectLabel"
    :loading="isCropping"
    @confirm="handleConfirm"
  />
</template>
