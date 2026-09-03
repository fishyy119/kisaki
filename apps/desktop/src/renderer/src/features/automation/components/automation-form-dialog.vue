<!--
Automation Form Dialog creates and edits triggered command invocations.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Field, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { Input } from '@renderer/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from '@renderer/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Textarea } from '@renderer/components/ui/textarea'
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { useLiveQuery } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import type { Automation, AutomationFailurePolicy, AutomationTriggers } from '@shared/automation'
import { formatJson } from '../utils/display'
import CommandCombobox from './command-combobox.vue'

interface Props {
  automation?: Automation | null
}

interface Emits {
  (e: 'saved'): void
}

interface AutomationFormData {
  name: string
  commandId: string
  argsText: string
  onStartup: boolean
  cronConfigured: boolean
  cronExpression: string
  cronTimezone: string
  failureType: AutomationFailurePolicy['type']
  retryCount: string
  retryDelaySeconds: string
}

const props = withDefaults(defineProps<Props>(), {
  automation: null
})
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const formData = ref<AutomationFormData>(createDefaultFormData())
const isSaving = ref(false)
const triggerDialogOpen = ref(false)
const triggerDraftOnStartup = ref(false)
const triggerDraftCronExpression = ref('')
const triggerDraftCronTimezone = ref('')

const {
  data: commands,
  isLoading: commandsLoading,
  error: commandsError
} = useLiveQuery(() => ipcManager.invoke('command:list').then(unwrapIpcData), {
  enabled: () => open.value
})

const commandsList = computed(() => commands.value ?? [])
const isEditMode = computed(() => Boolean(props.automation))
const selectedCommand = computed(
  () => commandsList.value.find((command) => command.id === formData.value.commandId) ?? null
)
const selectedCommandDescription = computed(() => {
  if (!selectedCommand.value) {
    return formData.value.commandId ? m.value.automation.form.commandUnavailable : ''
  }

  return selectedCommand.value.description || selectedCommand.value.id
})
const dialogTitle = computed(() =>
  isEditMode.value ? m.value.automation.form.editTitle : m.value.automation.form.addTitle
)
const canSubmit = computed(() => Boolean(formData.value.commandId) && !isSaving.value)
const triggerSummary = computed(() => {
  const display = m.value.automation.display
  const labels: string[] = []
  if (formData.value.onStartup) {
    labels.push(display.onStartup)
  }
  if (formData.value.cronConfigured) {
    labels.push(`Cron ${formData.value.cronExpression}`)
  }
  return labels.length > 0 ? labels.join(display.triggerSeparator) : display.manualOnly
})
const triggerMeta = computed(() =>
  formData.value.cronConfigured
    ? formData.value.cronTimezone || m.value.automation.display.systemTimezone
    : m.value.automation.form.configure
)

const commandIdModel = computed({
  get: () => formData.value.commandId,
  set: (commandId: string) => {
    formData.value.commandId = commandId
    applyCommandDefaults(commandId)
  }
})

watch(
  [() => open.value, () => props.automation?.id],
  ([isOpen]) => {
    if (!isOpen) {
      return
    }

    resetForm()
  },
  { immediate: true }
)

watch(
  commandsList,
  () => {
    if (!open.value || isEditMode.value || formData.value.commandId) {
      return
    }

    const firstCommand = commandsList.value[0]
    if (firstCommand) {
      commandIdModel.value = firstCommand.id
    }
  },
  { immediate: true }
)

async function handleSubmit() {
  if (!formData.value.commandId) {
    notify.warning(m.value.automation.feedback.selectCommand)
    return
  }

  let args: Record<string, unknown>
  let triggers: AutomationTriggers
  let failurePolicy: AutomationFailurePolicy
  try {
    args = parseArgs()
    triggers = createTriggers()
    failurePolicy = createFailurePolicy()
  } catch (error) {
    notify.warning(error instanceof Error ? error.message : String(error))
    return
  }

  const automationName =
    formData.value.name.trim() || selectedCommand.value?.title || formData.value.commandId
  isSaving.value = true
  try {
    if (props.automation) {
      unwrapIpcData(
        await ipcManager.invoke('automation:update', props.automation.id, {
          name: automationName,
          commandId: formData.value.commandId,
          args,
          triggers,
          failurePolicy
        })
      )
      notify.success(m.value.automation.feedback.updated)
    } else {
      unwrapIpcData(
        await ipcManager.invoke('automation:create', {
          name: automationName,
          commandId: formData.value.commandId,
          args,
          triggers,
          failurePolicy
        })
      )
      notify.success(m.value.automation.feedback.added)
    }

    emit('saved')
    open.value = false
  } catch (error) {
    notify.error(
      m.value.automation.feedback.saveFailed,
      error instanceof Error ? error.message : String(error)
    )
  } finally {
    isSaving.value = false
  }
}

function resetForm() {
  formData.value = props.automation
    ? createFormDataFromAutomation(props.automation)
    : createDefaultFormData()

  if (!props.automation && commandsList.value[0]) {
    commandIdModel.value = commandsList.value[0].id
  }
}

function applyCommandDefaults(commandId: string) {
  if (isEditMode.value) {
    return
  }

  const command = commandsList.value.find((item) => item.id === commandId)
  if (!command) {
    return
  }

  if (!formData.value.name.trim()) {
    formData.value.name = command.title
  }
  formData.value.argsText = formatJson(command.defaultArgs ?? {})
}

function createDefaultFormData(): AutomationFormData {
  return {
    name: '',
    commandId: '',
    argsText: '{}',
    onStartup: false,
    cronConfigured: false,
    cronExpression: '0 4 * * *',
    cronTimezone: '',
    failureType: 'none',
    retryCount: '0',
    retryDelaySeconds: '5'
  }
}

function createFormDataFromAutomation(automation: Automation): AutomationFormData {
  const data = createDefaultFormData()

  data.name = automation.name
  data.commandId = automation.commandId
  data.argsText = formatJson(automation.args ?? {})
  data.onStartup = automation.triggers.onStartup
  data.cronConfigured = Boolean(automation.triggers.cron)
  data.cronExpression = automation.triggers.cron?.expression ?? data.cronExpression
  data.cronTimezone = automation.triggers.cron?.timezone ?? ''
  data.failureType = automation.failurePolicy.type

  if (automation.failurePolicy.type !== 'none') {
    data.retryCount = String(automation.failurePolicy.retryCount ?? 0)
    data.retryDelaySeconds =
      automation.failurePolicy.retryDelayMs === undefined
        ? '5'
        : String(automation.failurePolicy.retryDelayMs / 1_000)
  }

  return data
}

function parseArgs(): Record<string, unknown> {
  const rawArgs = formData.value.argsText.trim()
  if (!rawArgs) {
    return {}
  }

  const parsed = JSON.parse(rawArgs) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(m.value.automation.form.paramsMustBeObject)
  }

  return parsed as Record<string, unknown>
}

function createTriggers(): AutomationTriggers {
  const triggers: AutomationTriggers = {
    onStartup: formData.value.onStartup
  }

  if (!formData.value.cronConfigured) {
    return triggers
  }

  const expression = formData.value.cronExpression.trim()
  if (!expression) {
    throw new Error(m.value.automation.form.cronRequired)
  }

  const timezone = parseOptionalTimezone(formData.value.cronTimezone)
  triggers.cron = timezone ? { expression, timezone } : { expression }
  return triggers
}

function openTriggerDialog() {
  triggerDraftOnStartup.value = formData.value.onStartup
  triggerDraftCronExpression.value = formData.value.cronConfigured
    ? formData.value.cronExpression
    : ''
  triggerDraftCronTimezone.value = formData.value.cronTimezone
  triggerDialogOpen.value = true
}

function handleSaveTrigger() {
  const expression = triggerDraftCronExpression.value.trim()
  let timezone: string | undefined
  if (expression) {
    try {
      timezone = parseOptionalTimezone(triggerDraftCronTimezone.value)
    } catch (error) {
      notify.warning(error instanceof Error ? error.message : String(error))
      return
    }
  }

  formData.value.onStartup = triggerDraftOnStartup.value
  formData.value.cronConfigured = Boolean(expression)
  formData.value.cronExpression = expression || '0 4 * * *'
  formData.value.cronTimezone = expression ? (timezone ?? '') : ''
  triggerDialogOpen.value = false
}

function createFailurePolicy(): AutomationFailurePolicy {
  if (formData.value.failureType === 'none') {
    return { type: 'none' }
  }

  const retryCount = parseNonNegativeInteger(
    formData.value.retryCount,
    m.value.automation.form.retryCountLabel
  )
  const retryDelayMs = parseOptionalDelayMs(formData.value.retryDelaySeconds)

  if (formData.value.failureType === 'retry') {
    return retryDelayMs === undefined
      ? { type: 'retry', retryCount }
      : { type: 'retry', retryCount, retryDelayMs }
  }

  return retryDelayMs === undefined
    ? { type: 'pauseAutomation', retryCount }
    : { type: 'pauseAutomation', retryCount, retryDelayMs }
}

function parsePositiveNumber(value: string, label: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(m.value.automation.form.mustBePositive({ label }))
  }
  return parsed
}

function parseNonNegativeInteger(value: string, label: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw new Error(m.value.automation.form.mustBeNonNegativeInteger({ label }))
  }
  return parsed
}

function parseOptionalDelayMs(value: string): number | undefined {
  if (!value.trim()) {
    return undefined
  }

  return Math.round(
    parsePositiveNumber(value, m.value.automation.form.retryDelaySecondsLabel) * 1_000
  )
}

function parseOptionalTimezone(value: string): string | undefined {
  const timezone = value.trim()
  if (!timezone) {
    return undefined
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
  } catch {
    throw new Error(m.value.automation.form.invalidTimezone)
  }

  return timezone
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
      </DialogHeader>

      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field :label="m.automation.form.name">
              <FieldContent>
                <Input
                  v-model="formData.name"
                  :placeholder="m.automation.form.namePlaceholder"
                />
              </FieldContent>
            </Field>

            <Field :label="m.automation.form.command">
              <FieldContent>
                <CommandCombobox
                  v-model="commandIdModel"
                  :commands="commandsList"
                  :disabled="commandsLoading"
                  class="w-full"
                />
                <div class="truncate text-xs text-muted-foreground">
                  <template v-if="commandsError">{{ commandsError }}</template>
                  <template v-else>{{ selectedCommandDescription }}</template>
                </div>
              </FieldContent>
            </Field>

            <Field :label="m.automation.form.trigger">
              <FieldContent>
                <Button
                  type="button"
                  variant="input"
                  class="w-full justify-start"
                  @click="openTriggerDialog"
                >
                  <Icon
                    icon="icon-[mdi--calendar-clock-outline]"
                    class="size-4"
                  />
                  <span class="min-w-0 truncate">{{ triggerSummary }}</span>
                  <span class="ml-auto shrink-0 text-xs text-muted-foreground">
                    {{ triggerMeta }}
                  </span>
                </Button>
              </FieldContent>
            </Field>

            <div class="flex flex-wrap items-start gap-4">
              <Field
                :label="m.automation.form.failurePolicy"
                class="w-56 shrink-0"
              >
                <FieldContent>
                  <Select v-model="formData.failureType">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{{ m.automation.form.policyNone }}</SelectItem>
                      <SelectItem value="retry">{{ m.automation.form.policyRetry }}</SelectItem>
                      <SelectItem value="pauseAutomation">
                        {{ m.automation.form.policyPause }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <Field
                v-if="formData.failureType !== 'none'"
                :label="m.automation.form.retryCount"
                class="w-32 shrink-0"
              >
                <FieldContent>
                  <Input
                    v-model="formData.retryCount"
                    type="number"
                    min="0"
                    step="1"
                  />
                </FieldContent>
              </Field>

              <Field
                v-if="formData.failureType !== 'none'"
                :label="m.automation.form.retryDelay"
                class="w-40 shrink-0"
              >
                <FieldContent>
                  <InputGroup>
                    <InputGroupInput
                      v-model="formData.retryDelaySeconds"
                      type="number"
                      min="0.01"
                      step="any"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{{ m.automation.form.seconds }}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </FieldContent>
              </Field>
            </div>

            <Field :label="m.automation.form.params">
              <FieldContent>
                <Textarea
                  v-model="formData.argsText"
                  class="min-h-40 font-mono leading-relaxed"
                  :rows="10"
                />
              </FieldContent>
            </Field>
          </FieldGroup>
        </DialogBody>

        <DialogFooter>
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
            :disabled="!canSubmit"
          >
            <Icon
              icon="icon-[mdi--content-save-outline]"
              class="size-4"
            />
            {{ isSaving ? m.states.saving : m.actions.save }}
          </Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="triggerDialogOpen">
    <DialogContent size="sm">
      <DialogHeader>
        <DialogTitle>{{ m.automation.form.configureTrigger }}</DialogTitle>
      </DialogHeader>

      <Form @submit="handleSaveTrigger">
        <DialogBody>
          <FieldGroup>
            <Field
              :label="m.automation.form.runOnStartup"
              orientation="horizontal"
            >
              <Checkbox v-model="triggerDraftOnStartup" />
            </Field>

            <Field
              :label="m.automation.form.expression"
              orientation="horizontal"
            >
              <FieldContent class="w-72">
                <Input
                  v-model="triggerDraftCronExpression"
                  :placeholder="m.automation.form.cronPlaceholder"
                />
              </FieldContent>
            </Field>

            <Field
              :label="m.automation.form.timezone"
              orientation="horizontal"
            >
              <FieldContent class="w-72">
                <Input
                  v-model="triggerDraftCronTimezone"
                  :placeholder="m.automation.form.timezonePlaceholder"
                />
              </FieldContent>
            </Field>
          </FieldGroup>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="triggerDialogOpen = false"
          >
            {{ m.actions.cancel }}
          </Button>
          <Button type="submit">{{ m.actions.save }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
