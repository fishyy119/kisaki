<script setup lang="ts">
/**
 * Scanner Name Extraction Rules Item Form Dialog
 *
 * Simple form for editing single rule (description + pattern).
 */

import { ref, watch } from 'vue'
import { nanoid } from 'nanoid'
import type { NameExtractionRule } from '@shared/db'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { useI18n } from '@renderer/composables/use-i18n'

// =============================================================================
// Props & Model & Emits
// =============================================================================

interface Props {
  rule: NameExtractionRule | null
  isNew: boolean
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

interface Emits {
  (e: 'save', rule: NameExtractionRule): void
}

const emit = defineEmits<Emits>()

const { m } = useI18n()

/** Locale-neutral regex token shown inline in the pattern hint. */
const NAME_GROUP_TOKEN = '(?<name>...)'

// =============================================================================
// State
// =============================================================================

interface FormData {
  description: string
  pattern: string
}

const formData = ref<FormData>({
  description: '',
  pattern: ''
})

// =============================================================================
// Initialize on Open
// =============================================================================

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen && props.rule) {
      formData.value.description = props.rule.description
      formData.value.pattern = props.rule.pattern
    }
  },
  { immediate: true }
)

// =============================================================================
// Handlers
// =============================================================================

function handleSubmit() {
  if (!formData.value.description.trim() || !formData.value.pattern.trim()) return

  emit('save', {
    id: props.rule?.id || nanoid(),
    description: formData.value.description.trim(),
    pattern: formData.value.pattern.trim(),
    enabled: props.rule?.enabled ?? true
  })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{ props.isNew ? m.scanner.rules.itemAddTitle : m.scanner.rules.itemEditTitle }}
        </DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ m.scanner.rules.description }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.description"
                  :placeholder="m.scanner.rules.descriptionPlaceholder"
                  required
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ m.scanner.rules.pattern }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.pattern"
                  placeholder="^\[.*?\]\s*(?<name>.+)"
                  class="font-mono text-sm"
                  required
                />
                <p class="text-xs text-muted-foreground mt-1">
                  {{ m.scanner.rules.patternHintBefore }}
                  <code class="text-primary">{{ NAME_GROUP_TOKEN }}</code>
                  {{ m.scanner.rules.patternHintAfter }}
                </p>
              </FieldContent>
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="open = false"
          >
            {{ m.common.cancel }}
          </Button>
          <Button type="submit">{{ m.common.confirm }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
