<!--
  GameMediaCropFormDialog
  Dialog for cropping game media images.
  Uses the reusable ImageCropperDialog component.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { attachment } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import type { GameMediaType } from '@shared/attachment'
import { GAME_MEDIA_TYPE_TO_FIELD } from '@shared/attachment'
import { games } from '@shared/db'
import {
  ImageCropperDialog,
  type CropConfirmPayload
} from '@renderer/components/ui/image-cropper-dialog'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface Props {
  gameId: string
  mediaType: GameMediaType
  currentFileName: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

// Aspect ratio constraints for each media type
const ASPECT_RATIOS: Record<GameMediaType, number | undefined> = {
  cover: 3 / 4,
  backdrop: 16 / 9,
  logo: undefined, // Free crop for logo
  icon: 1 // Square
}

const ASPECT_LABELS: Record<GameMediaType, string | undefined> = {
  cover: '3:4',
  backdrop: '16:9',
  logo: undefined,
  icon: '1:1'
}

const MEDIA_TYPE_LABELS = computed<Record<GameMediaType, string>>(() => ({
  cover: m.value.library.forms.mediaTypes.cover,
  backdrop: m.value.library.forms.mediaTypes.backdrop,
  logo: m.value.library.forms.mediaTypes.logo,
  icon: m.value.library.forms.mediaTypes.icon
}))

const isCropping = ref(false)

const imageSrc = computed(() => `attachment://games/${props.gameId}/${props.currentFileName}`)
const dialogTitle = computed(() =>
  m.value.library.forms.cropMediaTitle({ label: MEDIA_TYPE_LABELS.value[props.mediaType] })
)
const aspectRatio = computed(() => ASPECT_RATIOS[props.mediaType])
const aspectLabel = computed(() => ASPECT_LABELS[props.mediaType])

async function handleConfirm(payload: CropConfirmPayload) {
  isCropping.value = true

  try {
    const sourcePath = await attachment.getPath('games', props.gameId, props.currentFileName)

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

    await attachment.setFile(games, props.gameId, GAME_MEDIA_TYPE_TO_FIELD[props.mediaType], {
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
