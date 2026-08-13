<!--
  AssetUrlFormDialog
  Dialog for importing an entity's image asset from a URL.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
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
import { cn } from '@renderer/utils/cn'
import type { TableEntityType } from '../entity-tables'
import { ENTITY_ASSET_SPECS } from './asset-specs'

const { m } = useI18n()

interface Props {
  entityType: TableEntityType
  entityId: string
  slotType: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const spec = computed(() => ENTITY_ASSET_SPECS[props.entityType])
const slot = computed(() => spec.value.slots.find((s) => s.type === props.slotType)!)
const slotLabel = computed(() => slot.value.label(m.value))

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
    await spec.value.setFile(props.entityId, props.slotType, {
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
          m.library.forms.importMediaFromUrlTitle({ label: slotLabel })
        }}</DialogTitle>
        <DialogDescription>
          {{ m.library.forms.importMediaFromUrlDescription({ label: slotLabel }) }}
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
                'relative rounded-lg border bg-muted/50 overflow-hidden flex items-center justify-center max-w-[150px]',
                slot.aspectClass
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
