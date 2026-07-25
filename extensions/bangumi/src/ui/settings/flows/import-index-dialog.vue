<!-- Import a Bangumi index into the local game library with preview. -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import {
  Button,
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
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch
} from '@kisaki3/extension-ui-vue'
import type {
  BangumiImportIndexFormArgs,
  BangumiImportIndexTargetMode,
  BangumiPreviewGroupDto,
  BangumiSettingsOverview
} from '../../../shared/settings'
import { m } from '../i18n'
import { host, onHostPreviewProgress, toErrorMessage } from '../rpc'
import JobPreviewDialog from '../components/job-preview-dialog.vue'

interface Props {
  overview: BangumiSettingsOverview
  indexInput: string
}

interface IndexForm {
  profileId: string
  patchExisting: boolean
  targetCollectionMode: BangumiImportIndexTargetMode
  targetCollectionId: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const defaultProfileId = computed(() => props.overview.profiles[0]?.value ?? '')
const defaultCollectionId = computed(() => props.overview.collections[0]?.value ?? '')

const busy = ref<'preview' | 'run' | null>(null)
const preview = ref<readonly BangumiPreviewGroupDto[] | null>(null)
const previewOpen = ref(false)
const previewProgress = ref<string | null>(null)
const indexForm = reactive<IndexForm>({
  profileId: '',
  patchExisting: false,
  targetCollectionMode: 'none',
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
  indexForm.profileId = defaultProfileId.value
  indexForm.patchExisting = false
  indexForm.targetCollectionMode = 'none'
  indexForm.targetCollectionId = defaultCollectionId.value
  preview.value = null
  previewOpen.value = false
  previewProgress.value = null
}

async function previewIndex(): Promise<void> {
  busy.value = 'preview'
  previewProgress.value = null
  try {
    preview.value = await host.previewImportIndex(snapshotArgs())
    previewOpen.value = true
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    busy.value = null
    previewProgress.value = null
  }
}

async function runIndex(): Promise<void> {
  busy.value = 'run'
  try {
    await host.runImportIndex(snapshotArgs())
    previewOpen.value = false
    open.value = false
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    busy.value = null
  }
}

function snapshotArgs(): BangumiImportIndexFormArgs {
  return {
    profileId: indexForm.profileId,
    indexInput: props.indexInput,
    patchExisting: indexForm.patchExisting,
    targetCollectionMode: indexForm.targetCollectionMode,
    targetCollectionId:
      indexForm.targetCollectionMode === 'existing' ? indexForm.targetCollectionId || null : null
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ m.ui.importIndex.title }}</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[64vh] overflow-y-auto">
        <FieldGroup class="gap-4">
          <Field
            orientation="horizontal"
            :label="m.ui.importIndex.index"
          >
            <FieldContent class="flex-row items-center">
              <span class="text-sm break-all text-muted-foreground">{{ props.indexInput }}</span>
            </FieldContent>
          </Field>

          <Field
            orientation="horizontal"
            :label="m.ui.importIndex.profile"
          >
            <Select v-model="indexForm.profileId">
              <SelectTrigger class="min-w-44">
                <SelectValue :placeholder="m.ui.importIndex.profilePlaceholder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="profile in props.overview.profiles"
                  :key="profile.value"
                  :value="profile.value"
                >
                  {{ profile.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field :label="m.ui.importIndex.targetCollection">
            <RadioGroup v-model="indexForm.targetCollectionMode">
              <Label class="font-normal">
                <RadioGroupItem value="none" />
                {{ m.ui.importIndex.targetNone }}
              </Label>
              <Label class="font-normal">
                <RadioGroupItem value="existing" />
                {{ m.ui.importIndex.targetExisting }}
              </Label>
              <Label class="font-normal">
                <RadioGroupItem value="byIndexTitle" />
                {{ m.ui.importIndex.targetByIndexTitle }}
              </Label>
            </RadioGroup>
          </Field>

          <Field
            v-if="indexForm.targetCollectionMode === 'existing'"
            orientation="horizontal"
            :label="m.ui.importIndex.selectCollection"
          >
            <Select v-model="indexForm.targetCollectionId">
              <SelectTrigger class="min-w-44">
                <SelectValue :placeholder="m.ui.importIndex.collectionPlaceholder" />
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
          </Field>

          <Field
            orientation="horizontal"
            :label="m.ui.importIndex.patchExisting"
          >
            <Switch
              v-model="indexForm.patchExisting"
              :disabled="indexForm.targetCollectionMode === 'none'"
            />
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
          :disabled="busy !== null || props.overview.activeJobs.importIndex"
          @click="previewIndex"
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
          :disabled="busy !== null || props.overview.activeJobs.importIndex"
          @click="runIndex"
        >
          <Spinner v-if="busy === 'run' || props.overview.activeJobs.importIndex" />
          <Icon
            v-else
            icon="icon-[mdi--play]"
            class="size-3.5"
          />
          {{ m.ui.importIndex.start }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <JobPreviewDialog
    v-if="preview"
    v-model:open="previewOpen"
    :title="m.ui.importIndex.previewTitle"
    :description="m.ui.importIndex.previewDescription"
    :groups="preview"
    @error="(message) => emit('error', message)"
  >
    <template #footer>
      <Button
        size="sm"
        type="button"
        :disabled="busy !== null || props.overview.activeJobs.importIndex"
        @click="runIndex"
      >
        <Spinner v-if="busy === 'run' || props.overview.activeJobs.importIndex" />
        <Icon
          v-else
          icon="icon-[mdi--play]"
          class="size-3.5"
        />
        {{ m.ui.importIndex.start }}
      </Button>
    </template>
  </JobPreviewDialog>
</template>
