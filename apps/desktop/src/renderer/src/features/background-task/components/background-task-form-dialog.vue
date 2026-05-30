<!--
Background Task Form Dialog creates and edits triggered command invocations.
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
import { useAsyncData } from '@renderer/composables'
import type {
  BackgroundTask,
  BackgroundTaskFailurePolicy,
  BackgroundTaskTriggers
} from '@shared/background-task'
import { formatJson } from '../utils'
import CommandCombobox from './command-combobox.vue'

interface Props {
  task?: BackgroundTask | null
}

interface Emits {
  (e: 'saved'): void
}

interface TaskFormData {
  name: string
  commandId: string
  argsText: string
  onStartup: boolean
  cronConfigured: boolean
  cronExpression: string
  cronTimezone: string
  failureType: BackgroundTaskFailurePolicy['type']
  retryCount: string
  retryDelaySeconds: string
}

const props = withDefaults(defineProps<Props>(), {
  task: null
})
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })

const formData = ref<TaskFormData>(createDefaultFormData())
const isSaving = ref(false)
const triggerDialogOpen = ref(false)
const triggerDraftOnStartup = ref(false)
const triggerDraftCronExpression = ref('')
const triggerDraftCronTimezone = ref('')

const {
  data: commands,
  isLoading: commandsLoading,
  error: commandsError
} = useAsyncData(() => ipcManager.invoke('command:list').then(unwrapIpcData), {
  enabled: () => open.value
})

const commandsList = computed(() => commands.value ?? [])
const isEditMode = computed(() => Boolean(props.task))
const selectedCommand = computed(
  () => commandsList.value.find((command) => command.id === formData.value.commandId) ?? null
)
const selectedCommandDescription = computed(() => {
  if (!selectedCommand.value) {
    return formData.value.commandId ? '命令当前不可用' : ''
  }

  return selectedCommand.value.description || selectedCommand.value.id
})
const dialogTitle = computed(() => (isEditMode.value ? '编辑后台任务' : '添加后台任务'))
const canSubmit = computed(() => Boolean(formData.value.commandId) && !isSaving.value)
const triggerSummary = computed(() => {
  const labels: string[] = []
  if (formData.value.onStartup) {
    labels.push('启动时')
  }
  if (formData.value.cronConfigured) {
    labels.push(`Cron ${formData.value.cronExpression}`)
  }
  return labels.length > 0 ? labels.join('，') : '手动运行'
})
const triggerMeta = computed(() =>
  formData.value.cronConfigured ? formData.value.cronTimezone || '系统时区' : '配置'
)

const commandIdModel = computed({
  get: () => formData.value.commandId,
  set: (commandId: string) => {
    formData.value.commandId = commandId
    applyCommandDefaults(commandId)
  }
})

watch(
  [() => open.value, () => props.task?.id],
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
    notify.warning('请选择命令')
    return
  }

  let args: Record<string, unknown>
  let triggers: BackgroundTaskTriggers
  let failurePolicy: BackgroundTaskFailurePolicy
  try {
    args = parseArgs()
    triggers = createTriggers()
    failurePolicy = createFailurePolicy()
  } catch (error) {
    notify.warning(error instanceof Error ? error.message : String(error))
    return
  }

  const taskName =
    formData.value.name.trim() || selectedCommand.value?.title || formData.value.commandId
  const ownerExtensionId = selectedCommand.value?.ownerExtensionId ?? props.task?.ownerExtensionId

  isSaving.value = true
  try {
    if (props.task) {
      unwrapIpcData(
        await ipcManager.invoke('background-task:update', props.task.id, {
          name: taskName,
          ownerExtensionId,
          commandId: formData.value.commandId,
          args,
          triggers,
          failurePolicy
        })
      )
      notify.success('后台任务已更新')
    } else {
      unwrapIpcData(
        await ipcManager.invoke('background-task:create', {
          name: taskName,
          ownerExtensionId,
          createdBy: 'user',
          commandId: formData.value.commandId,
          args,
          triggers,
          failurePolicy
        })
      )
      notify.success('后台任务已添加')
    }

    emit('saved')
    open.value = false
  } catch (error) {
    notify.error('保存后台任务失败', error instanceof Error ? error.message : String(error))
  } finally {
    isSaving.value = false
  }
}

function resetForm() {
  formData.value = props.task ? createFormDataFromTask(props.task) : createDefaultFormData()

  if (!props.task && commandsList.value[0]) {
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

function createDefaultFormData(): TaskFormData {
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

function createFormDataFromTask(task: BackgroundTask): TaskFormData {
  const data = createDefaultFormData()

  data.name = task.name
  data.commandId = task.commandId
  data.argsText = formatJson(task.args ?? {})
  data.onStartup = task.triggers.onStartup
  data.cronConfigured = Boolean(task.triggers.cron)
  data.cronExpression = task.triggers.cron?.expression ?? data.cronExpression
  data.cronTimezone = task.triggers.cron?.timezone ?? ''
  data.failureType = task.failurePolicy.type

  if (task.failurePolicy.type !== 'none') {
    data.retryCount = String(task.failurePolicy.retryCount ?? 0)
    data.retryDelaySeconds =
      task.failurePolicy.retryDelayMs === undefined
        ? '5'
        : String(task.failurePolicy.retryDelayMs / 1_000)
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
    throw new Error('参数必须是 JSON 对象')
  }

  return parsed as Record<string, unknown>
}

function createTriggers(): BackgroundTaskTriggers {
  const triggers: BackgroundTaskTriggers = {
    onStartup: formData.value.onStartup
  }

  if (!formData.value.cronConfigured) {
    return triggers
  }

  const expression = formData.value.cronExpression.trim()
  if (!expression) {
    throw new Error('Cron 表达式不能为空')
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

function createFailurePolicy(): BackgroundTaskFailurePolicy {
  if (formData.value.failureType === 'none') {
    return { type: 'none' }
  }

  const retryCount = parseNonNegativeInteger(formData.value.retryCount, '重试次数')
  const retryDelayMs = parseOptionalDelayMs(formData.value.retryDelaySeconds)

  if (formData.value.failureType === 'retry') {
    return retryDelayMs === undefined
      ? { type: 'retry', retryCount }
      : { type: 'retry', retryCount, retryDelayMs }
  }

  return retryDelayMs === undefined
    ? { type: 'pauseTask', retryCount }
    : { type: 'pauseTask', retryCount, retryDelayMs }
}

function parsePositiveNumber(value: string, label: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label}必须大于 0`)
  }
  return parsed
}

function parseNonNegativeInteger(value: string, label: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw new Error(`${label}必须是大于等于 0 的整数`)
  }
  return parsed
}

function parseOptionalDelayMs(value: string): number | undefined {
  if (!value.trim()) {
    return undefined
  }

  return Math.round(parsePositiveNumber(value, '重试延迟秒数') * 1_000)
}

function parseOptionalTimezone(value: string): string | undefined {
  const timezone = value.trim()
  if (!timezone) {
    return undefined
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
  } catch {
    throw new Error('时区无效')
  }

  return timezone
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
      </DialogHeader>

      <Form @submit="handleSubmit">
        <DialogBody class="max-h-[72vh] overflow-auto scrollbar-thin">
          <FieldGroup>
            <Field label="名称">
              <FieldContent>
                <Input
                  v-model="formData.name"
                  placeholder="任务名称"
                />
              </FieldContent>
            </Field>

            <Field label="命令">
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

            <Field label="触发">
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
                label="失败策略"
                class="w-56 shrink-0"
              >
                <FieldContent>
                  <Select v-model="formData.failureType">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不重试</SelectItem>
                      <SelectItem value="retry">重试</SelectItem>
                      <SelectItem value="pauseTask">失败后暂停</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <Field
                v-if="formData.failureType !== 'none'"
                label="重试次数"
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
                label="重试延迟"
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
                      <InputGroupText>秒</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </FieldContent>
              </Field>
            </div>

            <Field label="参数">
              <FieldContent>
                <Textarea
                  v-model="formData.argsText"
                  class="min-h-40 font-mono text-xs leading-relaxed"
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
            取消
          </Button>
          <Button
            type="submit"
            :disabled="!canSubmit"
          >
            <Icon
              icon="icon-[mdi--content-save-outline]"
              class="size-4"
            />
            {{ isSaving ? '保存中' : '保存' }}
          </Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="triggerDialogOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>配置触发</DialogTitle>
      </DialogHeader>

      <Form @submit="handleSaveTrigger">
        <DialogBody>
          <FieldGroup>
            <Field
              label="启动时运行"
              orientation="horizontal"
            >
              <Checkbox v-model="triggerDraftOnStartup" />
            </Field>

            <Field
              label="表达式"
              orientation="horizontal"
            >
              <FieldContent class="w-72">
                <Input
                  v-model="triggerDraftCronExpression"
                  placeholder="Cron 表达式，留空则不启用"
                />
              </FieldContent>
            </Field>

            <Field
              label="时区"
              orientation="horizontal"
            >
              <FieldContent class="w-72">
                <Input
                  v-model="triggerDraftCronTimezone"
                  placeholder="系统时区"
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
            取消
          </Button>
          <Button type="submit">保存</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
