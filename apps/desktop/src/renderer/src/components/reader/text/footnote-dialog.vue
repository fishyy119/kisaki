<!--
Shows a footnote without leaving the page it was referenced from.
Boundary: the engine extracts the fragment and renders it into its own element;
this dialog only hosts that element and owns when it is on screen.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { useI18n } from '@renderer/composables/use-i18n'

const props = defineProps<{
  /** Rendered fragment element, owned by the engine that produced it. */
  content: HTMLElement | null
}>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const host = ref<HTMLElement | null>(null)

watch([host, () => props.content], ([element, content]) => {
  if (!element) return
  element.replaceChildren()
  if (content) element.append(content)
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="md">
      <DialogHeader>
        <DialogTitle>{{ m.reader.footnote.title }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div
          ref="host"
          class="h-64 w-full"
        />
      </DialogBody>
    </DialogContent>
  </Dialog>
</template>
