<!--
  GameMediaUrlFormDialog
  Dialog for importing game media from a URL.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import type { GameMediaType } from '@shared/attachment'
import { GAME_MEDIA_TYPE_TO_FIELD } from '@shared/attachment'
import { games } from '@shared/db'
import { attachment } from '@renderer/core/db'
import { cn } from '@renderer/utils/cn'
import { notify } from '@renderer/core/notify'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogDescription
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldGroup,
  FieldDescription
} from '@renderer/components/ui/field'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface Props {
  gameId: string
  mediaType: GameMediaType
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const MEDIA_TYPE_LABEL = computed<Record<GameMediaType, string>>(() => ({
  cover: m.value.library.forms.mediaTypes.cover,
  backdrop: m.value.library.forms.mediaTypes.backdrop,
  logo: m.value.library.forms.mediaTypes.logo,
  icon: m.value.library.forms.mediaTypes.icon
}))

// Form state
interface FormData {
  url: string
}

const formData = ref<FormData>({
  url: ''
})
const isImporting = ref(false)
const previewError = ref(false)

// Initialize form state when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      formData.value.url = ''
      previewError.value = false
    }
  }
)

const isValidUrl = computed(
  () =>
    formData.value.url.trim().startsWith('http://') ||
    formData.value.url.trim().startsWith('https://')
)

async function handleImport() {
  if (!isValidUrl.value) {
    notify.error(m.value.library.forms.imageUrlInvalid)
    return
  }

  isImporting.value = true

  try {
    await attachment.setFile(games, props.gameId, GAME_MEDIA_TYPE_TO_FIELD[props.mediaType], {
      kind: 'url',
      url: formData.value.url.trim()
    })

    notify.success(m.value.library.forms.mediaUpdated)
    open.value = false
  } finally {
    isImporting.value = false
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && isValidUrl.value && !isImporting.value) {
    handleImport()
  }
}

function handleClose() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{
          m.library.forms.importMediaFromUrlTitle({ label: MEDIA_TYPE_LABEL[props.mediaType] })
        }}</DialogTitle>
        <DialogDescription>
          {{
            m.library.forms.importMediaFromUrlDescription({
              label: MEDIA_TYPE_LABEL[props.mediaType]
            })
          }}
        </DialogDescription>
      </DialogHeader>

      <DialogBody class="space-y-4">
        <FieldGroup>
          <Field>
            <FieldLabel>{{ m.library.forms.imageUrlLabel }}</FieldLabel>
            <FieldContent>
              <Input
                v-model="formData.url"
                type="url"
                placeholder="https://example.com/image.jpg"
                autofocus
                @keydown="handleKeyDown"
              />
            </FieldContent>
            <FieldDescription>{{ m.library.forms.imageFormatsHint }}</FieldDescription>
          </Field>
        </FieldGroup>

        <!-- Preview -->
        <div
          v-if="isValidUrl"
          class="space-y-2"
        >
          <span class="text-xs text-muted-foreground">{{ m.library.forms.previewLabel }}</span>
          <div
            :class="
              cn(
                'relative rounded-lg border bg-muted/50 overflow-hidden',
                'flex items-center justify-center',
                props.mediaType === 'cover' && 'aspect-[3/4] max-w-[150px]',
                props.mediaType === 'backdrop' && 'aspect-video',
                props.mediaType === 'logo' && 'aspect-[3/1]',
                props.mediaType === 'icon' && 'aspect-square max-w-[80px]'
              )
            "
          >
            <div
              v-if="previewError"
              class="flex flex-col items-center gap-1 text-muted-foreground p-4"
            >
              <Icon
                icon="icon-[mdi--image-off-outline]"
                class="size-8"
              />
              <span class="text-xs">{{ m.library.forms.previewLoadFailed }}</span>
            </div>
            <img
              v-else
              :src="formData.url"
              :alt="m.common.preview"
              class="size-full object-contain"
              @error="previewError = true"
            />
          </div>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          @click="handleClose"
        >
          {{ m.common.cancel }}
        </Button>
        <Button
          :disabled="!isValidUrl || isImporting"
          @click="handleImport"
        >
          <template v-if="isImporting">
            <Icon
              icon="icon-[mdi--loading]"
              class="size-4 animate-spin"
            />
            {{ m.library.forms.importing }}
          </template>
          <template v-else>
            <Icon
              icon="icon-[mdi--download]"
              class="size-4"
            />
            {{ m.common.import }}
          </template>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
