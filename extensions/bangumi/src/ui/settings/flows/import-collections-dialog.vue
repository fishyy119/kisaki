<!-- Import current user's Bangumi collections with one-run options and preview. -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldContent,
  FieldGroup,
  Icon,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch
} from '@kisaki3/extension-ui-vue'
import type { BangumiMediaScope } from '../../../shared/scopes'
import type {
  BangumiImportCollectionsFormArgs,
  BangumiImportDataItem,
  BangumiOptionItem,
  BangumiPreviewGroupDto,
  BangumiSettingsOverview
} from '../../../shared/settings'
import { m } from '../i18n'
import { host, onHostPreviewProgress, toErrorMessage } from '../rpc'
import JobPreviewDialog from '../components/job-preview-dialog.vue'

interface Props {
  overview: BangumiSettingsOverview
  scope: BangumiMediaScope
  profiles: readonly BangumiOptionItem[]
}

interface CollectionsForm {
  profileId: string
  collectionTypes: number[]
  dataItems: BangumiImportDataItem[]
  patchExisting: boolean
  useTargetCollection: boolean
  targetCollectionId: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const COLLECTION_TYPE_VALUES = [1, 2, 3, 4, 5] as const

const collectionTypes = computed<readonly { value: number; label: string }[]>(() =>
  COLLECTION_TYPE_VALUES.map((value) => ({
    value,
    label: m.value.media.collections[props.scope][value]
  }))
)

const dataItems = computed<readonly { value: BangumiImportDataItem; label: string }[]>(() => [
  { value: 'status', label: m.value.ui.importCollections.itemStatus },
  { value: 'score', label: m.value.ui.importCollections.itemScore },
  { value: 'tags', label: m.value.ui.importCollections.itemTags },
  // Unit progress only exists on book subjects (vol_status / ep_status).
  ...(props.scope === 'book'
    ? [
        {
          value: 'unitProgress' as const,
          label: m.value.ui.importCollections.itemUnitProgress
        }
      ]
    : [])
])

const defaultProfileId = computed(() => props.profiles[0]?.value ?? '')
const defaultCollectionId = computed(() => props.overview.collections[0]?.value ?? '')

const busy = ref<'preview' | 'run' | null>(null)
const preview = ref<readonly BangumiPreviewGroupDto[] | null>(null)
const previewOpen = ref(false)
const previewProgress = ref<string | null>(null)
const collectionsForm = reactive<CollectionsForm>({
  profileId: '',
  collectionTypes: [1, 2, 3, 4, 5],
  dataItems: [],
  patchExisting: false,
  useTargetCollection: false,
  targetCollectionId: ''
})

let stopProgressListener: (() => void) | null = null

onMounted(() => {
  stopProgressListener = onHostPreviewProgress((label) => {
    if (busy.value === 'preview') {
      previewProgress.value = label
    }
  })
})

onUnmounted(() => {
  stopProgressListener?.()
})

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      initializeForm()
    }
  },
  { immediate: true }
)

function initializeForm(): void {
  collectionsForm.profileId = defaultProfileId.value
  collectionsForm.collectionTypes = [...COLLECTION_TYPE_VALUES]
  collectionsForm.dataItems = []
  collectionsForm.patchExisting = false
  collectionsForm.useTargetCollection = false
  collectionsForm.targetCollectionId = defaultCollectionId.value
  preview.value = null
  previewOpen.value = false
  previewProgress.value = null
}

function toggleArrayValue<T>(values: readonly T[], value: T, checked: boolean): T[] {
  const next = new Set(values)
  if (checked) {
    next.add(value)
  } else {
    next.delete(value)
  }
  return [...next]
}

async function previewCollections(): Promise<void> {
  busy.value = 'preview'
  previewProgress.value = null
  try {
    preview.value = await host.previewImportCollections(snapshotArgs())
    previewOpen.value = true
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    busy.value = null
    previewProgress.value = null
  }
}

async function runCollections(): Promise<void> {
  busy.value = 'run'
  try {
    await host.runImportCollections(snapshotArgs())
    previewOpen.value = false
    open.value = false
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    busy.value = null
  }
}

function snapshotArgs(): BangumiImportCollectionsFormArgs {
  return {
    scope: props.scope,
    profileId: collectionsForm.profileId,
    collectionTypes: [...collectionsForm.collectionTypes],
    dataItems: [...collectionsForm.dataItems],
    patchExisting: collectionsForm.patchExisting,
    targetCollectionId: collectionsForm.useTargetCollection
      ? collectionsForm.targetCollectionId || null
      : null
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle>{{ m.ui.importCollections.title }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <FieldGroup class="gap-4">
          <Field
            orientation="horizontal"
            :label="m.ui.importCollections.profile"
          >
            <Select v-model="collectionsForm.profileId">
              <SelectTrigger class="min-w-44">
                <SelectValue :placeholder="m.ui.importCollections.profilePlaceholder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="profile in props.profiles"
                  :key="profile.value"
                  :value="profile.value"
                >
                  {{ profile.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            orientation="horizontal"
            :label="m.ui.importCollections.collectionTypes"
          >
            <FieldContent class="grid grid-cols-5 gap-x-3 gap-y-2">
              <Label
                v-for="type in collectionTypes"
                :key="type.value"
                class="font-normal"
              >
                <Checkbox
                  :model-value="collectionsForm.collectionTypes.includes(type.value)"
                  @update:model-value="
                    (checked) =>
                      (collectionsForm.collectionTypes = toggleArrayValue(
                        collectionsForm.collectionTypes,
                        type.value,
                        checked === true
                      ))
                  "
                />
                {{ type.label }}
              </Label>
            </FieldContent>
          </Field>

          <Field
            orientation="horizontal"
            :label="m.ui.importCollections.dataItems"
          >
            <FieldContent class="flex-row items-center gap-3">
              <Label
                v-for="item in dataItems"
                :key="item.value"
                class="font-normal"
              >
                <Checkbox
                  :model-value="collectionsForm.dataItems.includes(item.value)"
                  @update:model-value="
                    (checked) =>
                      (collectionsForm.dataItems = toggleArrayValue(
                        collectionsForm.dataItems,
                        item.value,
                        checked === true
                      ))
                  "
                />
                {{ item.label }}
              </Label>
            </FieldContent>
          </Field>

          <Field
            orientation="horizontal"
            :label="m.ui.importCollections.patchExisting"
          >
            <Switch v-model="collectionsForm.patchExisting" />
          </Field>

          <Field
            orientation="horizontal"
            :label="m.ui.importCollections.targetCollection"
          >
            <FieldContent class="flex-row items-center gap-2">
              <Switch v-model="collectionsForm.useTargetCollection" />
              <Select
                v-if="collectionsForm.useTargetCollection"
                v-model="collectionsForm.targetCollectionId"
              >
                <SelectTrigger class="min-w-44">
                  <SelectValue :placeholder="m.ui.importCollections.collectionPlaceholder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="collection in props.overview.collections"
                    :key="collection.value"
                    :value="collection.value"
                  >
                    {{ collection.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
        </FieldGroup>
      </DialogBody>
      <DialogFooter>
        <span
          v-if="busy === 'preview' && previewProgress"
          class="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Spinner class="size-3" />
          {{ previewProgress }}
        </span>
        <Button
          variant="outline"
          size="sm"
          type="button"
          :disabled="busy !== null || props.overview.activeJobs.importCollections"
          @click="previewCollections"
        >
          <Spinner v-if="busy === 'preview'" />
          <Icon
            v-else
            icon="icon-[mdi--eye-outline]"
            class="size-3.5"
          />
          {{ m.common.preview }}
        </Button>
        <Button
          size="sm"
          type="button"
          :disabled="busy !== null || props.overview.activeJobs.importCollections"
          @click="runCollections"
        >
          <Spinner v-if="busy === 'run' || props.overview.activeJobs.importCollections" />
          <Icon
            v-else
            icon="icon-[mdi--play]"
            class="size-3.5"
          />
          {{ m.ui.importCollections.start }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <JobPreviewDialog
    v-if="preview"
    v-model:open="previewOpen"
    :title="m.ui.importCollections.previewTitle"
    :description="m.ui.importCollections.previewDescription"
    :groups="preview"
    @error="(message) => emit('error', message)"
  >
    <template #footer>
      <Button
        size="sm"
        type="button"
        :disabled="busy !== null || props.overview.activeJobs.importCollections"
        @click="runCollections"
      >
        <Spinner v-if="busy === 'run' || props.overview.activeJobs.importCollections" />
        <Icon
          v-else
          icon="icon-[mdi--play]"
          class="size-3.5"
        />
        {{ m.ui.importCollections.start }}
      </Button>
    </template>
  </JobPreviewDialog>
</template>
