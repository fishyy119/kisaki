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
import { formatSignerDate, formatSignerOptionalValue } from './display'

interface Props {
  signer: ExtensionTrustedSignerInfo
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>签名详情</DialogTitle>
        <DialogDescription>
          {{ props.signer.extensionId }}
        </DialogDescription>
      </DialogHeader>

      <DialogBody class="max-h-[70vh] overflow-auto">
        <FieldGroup class="gap-4">
          <Field orientation="horizontal">
            <FieldLabel>扩展 ID</FieldLabel>
            <FieldContent class="justify-self-start">
              <span class="font-mono text-xs">{{ props.signer.extensionId }}</span>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>算法</FieldLabel>
            <FieldContent class="justify-self-start">
              <span class="font-mono text-xs">{{ props.signer.algorithm }}</span>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>密钥 ID</FieldLabel>
            <FieldContent class="justify-self-start">
              <span class="font-mono text-xs">{{
                formatSignerOptionalValue(props.signer.label)
              }}</span>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>签名指纹</FieldLabel>
            <FieldContent>
              <span class="break-all font-mono text-xs">{{ props.signer.fingerprint }}</span>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>公钥</FieldLabel>
            <FieldContent>
              <span class="break-all font-mono text-xs">{{ props.signer.publicKey }}</span>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>信任记录 ID</FieldLabel>
            <FieldContent>
              <span class="break-all font-mono text-xs">{{ props.signer.id }}</span>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>来源仓库 ID</FieldLabel>
            <FieldContent>
              <span class="break-all font-mono text-xs">
                {{ formatSignerOptionalValue(props.signer.trustedFromRepositoryId) }}
              </span>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>来源仓库 URL</FieldLabel>
            <FieldContent>
              <span class="break-all font-mono text-xs">
                {{ formatSignerOptionalValue(props.signer.trustedFromRepositoryUrl) }}
              </span>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>信任时间</FieldLabel>
            <FieldContent class="justify-self-start">
              <span class="text-xs">{{ formatSignerDate(props.signer.trustedAt) }}</span>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>创建时间</FieldLabel>
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
          关闭
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
