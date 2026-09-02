<script setup lang="ts">
/**
 * Scanner Form Dialog
 *
 * Dialog for creating or editing a scanner.
 * Uses watch(open) pattern to load/reset form data.
 */

import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { Icon } from '@renderer/components/ui/icon'
import { useAsyncData, useRenderState } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { scanners, type Scanner, type NameExtractionRule } from '@shared/db'
import { MEDIA_TYPES } from '@shared/entity-types'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { addScannerIgnoredName } from '../../ignored-names'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Field, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { Switch } from '@renderer/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { CollectionSelect } from '@renderer/components/shared/collection'
import { ScraperProfileSelect } from '@renderer/components/shared/scraper'
import ScannerTestDialog from './scanner-test-dialog.vue'
import { ScannerNameExtractionRulesFormDialog } from './name-extraction-rules-form-dialog'

// =============================================================================
// Props & Model
// =============================================================================

interface Props {
  scannerId?: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

// =============================================================================
// State
// =============================================================================

const isSaving = ref(false)
const scanner = ref<Scanner | null>(null)
const isTestDialogOpen = ref(false)
const isRulesDialogOpen = ref(false)

const { m } = useI18n()

const typeOptions = computed(() =>
  MEDIA_TYPES.map((type) => ({ value: type, label: m.value.library.entities[type] }))
)
const entityDepthHelp = computed(() => ({ text: m.value.scanner.form.entityDepthHelp }))
const scraperProfileHelp = computed(() => ({ text: m.value.scanner.form.scraperProfileHelp }))
const nameExtractionRulesHelp = computed(() => ({
  text: m.value.scanner.form.nameExtractionRulesHelp,
  icon: 'icon-[mdi--regex]'
}))
const nameExtractionRulesLink = computed(() => ({
  href: 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Regular_expressions/Named_capturing_group',
  label: m.value.scanner.form.nameExtractionRulesLink
}))

// Form state; an empty scraperProfileId means "no profile, import directly".
interface FormData {
  name: string
  path: string
  type: Scanner['type']
  scraperProfileId: string
  targetCollectionId: string | null
  watchEnabled: boolean
  entityDepth: number
  nameExtractionRules: NameExtractionRule[]
}

const formData = ref<FormData>({
  name: '',
  path: '',
  type: 'game',
  scraperProfileId: '',
  targetCollectionId: null,
  watchEnabled: true,
  entityDepth: 0,
  nameExtractionRules: []
})

// =============================================================================
// Computed
// =============================================================================

const isEdit = computed(() => !!props.scannerId)

// =============================================================================
// Load Data on Open
// =============================================================================

const { data, isLoading, error } = useAsyncData(
  async () => {
    if (!props.scannerId) return null
    return await db.query.scanners.findFirst({
      where: eq(scanners.id, props.scannerId)
    })
  },
  {
    watch: [() => props.scannerId],
    enabled: () => open.value && !!props.scannerId
  }
)
const state = useRenderState(isLoading, error, isEdit.value ? data : true)

// Initialize form when data loads or dialog opens
watch(
  [data, open],
  ([d, isOpen]) => {
    if (!isOpen) return
    if (d) {
      scanner.value = d
      formData.value = {
        name: d.name,
        path: d.path,
        type: d.type,
        scraperProfileId: d.scraperProfileId ?? '',
        targetCollectionId: d.targetCollectionId,
        watchEnabled: d.watchEnabled,
        entityDepth: d.entityDepth,
        nameExtractionRules: d.nameExtractionRules ?? []
      }
    } else if (!props.scannerId) {
      // Create mode: reset form
      scanner.value = null
      formData.value = {
        name: '',
        path: '',
        type: 'game',
        scraperProfileId: '',
        targetCollectionId: null,
        watchEnabled: true,
        entityDepth: 0,
        nameExtractionRules: []
      }
    }
  },
  { immediate: true }
)

// A profile only serves one media type, so the picked one cannot survive a switch.
watch(
  () => formData.value.type,
  (type, previousType) => {
    if (previousType && type !== previousType) {
      formData.value.scraperProfileId = ''
    }
  }
)

// =============================================================================
// Handlers
// =============================================================================

async function handleSelectPath() {
  const result = await ipcManager.invoke('native:open-dialog', {
    properties: ['openDirectory']
  })

  if (result.success && result.data && !result.data.canceled && result.data.filePaths.length > 0) {
    formData.value.path = result.data.filePaths[0]!
  }
}

async function handleSubmit() {
  if (!formData.value.name.trim() || !formData.value.path.trim()) {
    notify.error(m.value.scanner.form.requiredFields)
    return
  }

  isSaving.value = true
  try {
    const values = {
      name: formData.value.name.trim(),
      path: formData.value.path.trim(),
      type: formData.value.type,
      scraperProfileId: formData.value.scraperProfileId || null,
      targetCollectionId: formData.value.targetCollectionId,
      watchEnabled: formData.value.watchEnabled,
      entityDepth: formData.value.entityDepth,
      nameExtractionRules: formData.value.nameExtractionRules
    }

    if (isEdit.value && scanner.value) {
      await db.update(scanners).set(values).where(eq(scanners.id, scanner.value.id))
      notify.success(m.value.scanner.form.updated)
    } else {
      await db.insert(scanners).values(values)
      notify.success(m.value.scanner.form.created)
    }
    open.value = false
  } catch {
    notify.error(
      isEdit.value ? m.value.scanner.form.updateFailed : m.value.scanner.form.createFailed
    )
  } finally {
    isSaving.value = false
  }
}

function handleRulesSave(rules: NameExtractionRule[]) {
  formData.value.nameExtractionRules = rules
}

// Computed model for entity depth (parse string to number, clamp 0-5)
const entityDepthModel = computed({
  get: () => String(formData.value.entityDepth),
  set: (value: string) => {
    const num = parseInt(value, 10)
    formData.value.entityDepth = Number.isNaN(num) ? 0 : Math.max(0, Math.min(5, num))
  }
})

async function handleAddToIgnoreList(ignoreName: string) {
  await addScannerIgnoredName(ignoreName)
}

async function openLink(link: { href: string }): Promise<void> {
  try {
    unwrapIpcVoid(await ipcManager.invoke('native:open-external', link.href))
  } catch (error) {
    notify.error(
      m.value.scanner.form.openLinkFailed,
      error instanceof Error ? error.message : String(error)
    )
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {{ isEdit ? m.scanner.form.editTitle : m.scanner.form.createTitle }}
        </DialogTitle>
      </DialogHeader>

      <template v-if="state === 'loading'">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <template v-else>
        <Form @submit="handleSubmit">
          <DialogBody class="max-h-[60vh] overflow-auto">
            <FieldGroup>
              <Field :label="m.scanner.form.name">
                <FieldContent>
                  <Input
                    v-model="formData.name"
                    required
                    :placeholder="m.scanner.form.namePlaceholder"
                  />
                </FieldContent>
              </Field>

              <Field :label="m.scanner.form.type">
                <FieldContent>
                  <Select v-model="formData.type">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="option in typeOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <Field :label="m.scanner.form.scanPath">
                <FieldContent>
                  <div class="flex gap-2">
                    <Input
                      v-model="formData.path"
                      required
                      :placeholder="m.scanner.form.scanPathPlaceholder"
                      class="flex-1"
                    />
                    <Button
                      type="button"
                      variant="input"
                      size="icon"
                      @click="handleSelectPath"
                    >
                      <Icon
                        icon="icon-[mdi--folder-open-outline]"
                        class="size-4"
                      />
                    </Button>
                  </div>
                </FieldContent>
              </Field>

              <Field
                for="entityDepth"
                :label="m.scanner.form.entityDepth"
                :help="entityDepthHelp"
              >
                <FieldContent>
                  <Input
                    id="entityDepth"
                    v-model="entityDepthModel"
                    type="number"
                    :min="0"
                    :max="5"
                  />
                </FieldContent>
              </Field>

              <Field
                :label="m.scanner.form.scraperProfile"
                :help="scraperProfileHelp"
              >
                <FieldContent>
                  <ScraperProfileSelect
                    v-model="formData.scraperProfileId"
                    :media-type="formData.type"
                    allow-none
                  />
                </FieldContent>
              </Field>

              <Field :label="m.scanner.form.targetCollection">
                <FieldContent>
                  <CollectionSelect
                    v-model="formData.targetCollectionId"
                    allow-create
                    class="w-full"
                  />
                </FieldContent>
              </Field>

              <Field
                orientation="horizontal"
                :label="m.scanner.form.watchEnabled"
                :description="m.scanner.form.watchEnabledDescription"
              >
                <FieldContent>
                  <Switch v-model="formData.watchEnabled" />
                </FieldContent>
              </Field>

              <Field
                :label="m.scanner.form.nameExtractionRules"
                :help="nameExtractionRulesHelp"
                :link="nameExtractionRulesLink"
                @link-click="openLink"
              >
                <FieldContent>
                  <Button
                    type="button"
                    variant="input"
                    class="w-full justify-start"
                    @click="isRulesDialogOpen = true"
                  >
                    <Icon
                      icon="icon-[mdi--regex]"
                      class="size-4 mr-2"
                    />
                    {{ m.scanner.form.editRules }}
                    <span class="ml-auto text-muted-foreground">
                      {{
                        formData.nameExtractionRules.length === 0
                          ? m.scanner.form.notConfigured
                          : m.scanner.form.ruleCount({
                              count: formData.nameExtractionRules.length
                            })
                      }}
                    </span>
                  </Button>
                </FieldContent>
              </Field>
            </FieldGroup>
          </DialogBody>

          <DialogFooter class="flex justify-between">
            <Button
              type="button"
              variant="outline"
              :disabled="isSaving || !formData.path"
              @click="isTestDialogOpen = true"
            >
              <Icon
                icon="icon-[mdi--flask-outline]"
                class="size-4 mr-1.5"
              />
              {{ m.scanner.form.testConfig }}
            </Button>
            <div class="flex gap-2">
              <Button
                type="button"
                variant="outline"
                :disabled="isSaving"
                @click="open = false"
              >
                {{ m.actions.cancel }}
              </Button>
              <Button
                type="submit"
                :disabled="isSaving"
              >
                {{ m.actions.save }}
              </Button>
            </div>
          </DialogFooter>
        </Form>
      </template>
    </DialogContent>

    <ScannerTestDialog
      v-if="isTestDialogOpen"
      v-model:open="isTestDialogOpen"
      :scanner-path="formData.path"
      :entity-depth="formData.entityDepth"
      :rules="formData.nameExtractionRules"
      :on-add-to-ignore-list="handleAddToIgnoreList"
    />

    <ScannerNameExtractionRulesFormDialog
      v-if="isRulesDialogOpen"
      v-model:open="isRulesDialogOpen"
      :rules="formData.nameExtractionRules"
      @save="handleRulesSave"
    />
  </Dialog>
</template>
