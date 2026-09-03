<!--
Signer Details Dialog shows read-only trusted signer metadata.
Boundary: no mutations; consumes the signer DTO selected by the parent panel.
-->
<script setup lang="ts">
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@renderer/components/ui/field'
import type { ExtensionTrustedSignerInfo } from '@shared/extension'
import { useI18n } from '@renderer/composables/use-i18n'
import { formatSignerDate, formatSignerOptionalValue } from './display'

interface Props {
  signer: ExtensionTrustedSignerInfo
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="md">
      <DialogHeader>
        <DialogTitle>{{ m.extension.signer.details.title }}</DialogTitle>
        <DialogDescription>
          {{ props.signer.extensionId }}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldGroup class="gap-4">
          <Field orientation="horizontal">
            <FieldLabel>{{ m.extension.signer.details.extensionId }}</FieldLabel>
            <FieldContent class="justify-self-start">
              <span class="font-mono text-xs">{{ props.signer.extensionId }}</span>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>{{ m.extension.signer.details.algorithm }}</FieldLabel>
            <FieldContent class="justify-self-start">
              <span class="font-mono text-xs">{{ props.signer.algorithm }}</span>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>{{ m.extension.signer.details.keyId }}</FieldLabel>
            <FieldContent class="justify-self-start">
              <span class="font-mono text-xs">{{
                formatSignerOptionalValue(props.signer.label)
              }}</span>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>{{ m.extension.signer.details.fingerprint }}</FieldLabel>
            <FieldContent>
              <span class="wrap-anywhere font-mono text-xs">{{ props.signer.fingerprint }}</span>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>{{ m.extension.signer.details.publicKey }}</FieldLabel>
            <FieldContent>
              <span class="wrap-anywhere font-mono text-xs">{{ props.signer.publicKey }}</span>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>{{ m.extension.signer.details.trustRecordId }}</FieldLabel>
            <FieldContent>
              <span class="wrap-anywhere font-mono text-xs">{{ props.signer.id }}</span>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>{{ m.extension.signer.details.sourceRepositoryId }}</FieldLabel>
            <FieldContent>
              <span class="wrap-anywhere font-mono text-xs">
                {{ formatSignerOptionalValue(props.signer.trustedFromRepositoryId) }}
              </span>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>{{ m.extension.signer.details.sourceRepositoryUrl }}</FieldLabel>
            <FieldContent>
              <span class="wrap-anywhere font-mono text-xs">
                {{ formatSignerOptionalValue(props.signer.trustedFromRepositoryUrl) }}
              </span>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>{{ m.extension.signer.details.trustedAt }}</FieldLabel>
            <FieldContent class="justify-self-start">
              <span class="text-xs">{{ formatSignerDate(props.signer.trustedAt) }}</span>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>{{ m.extension.signer.details.createdAt }}</FieldLabel>
            <FieldContent class="justify-self-start">
              <span class="text-xs">{{ formatSignerDate(props.signer.createdAt) }}</span>
            </FieldContent>
          </Field>
        </FieldGroup>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          @click="open = false"
        >
          {{ m.actions.close }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
