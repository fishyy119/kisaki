<script setup lang="ts">
interface Props {
  title: string
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <div
    class="fixed inset-0 z-10 flex items-center justify-center bg-black/40"
    @click.self="emit('close')"
  >
    <div
      class="flex max-h-[calc(100vh-48px)] w-[min(560px,calc(100vw-48px))] flex-col rounded-lg border border-border bg-surface text-surface-foreground"
    >
      <header class="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <h2 class="m-0 text-[13px] font-semibold">{{ title }}</h2>
        <button
          type="button"
          class="border-none bg-transparent px-1.5 py-0.5 text-muted-foreground"
          @click="emit('close')"
        >
          ✕
        </button>
      </header>
      <div class="overflow-y-auto px-3.5 py-3">
        <slot />
      </div>
      <footer
        v-if="$slots.footer"
        class="flex justify-end gap-2 border-t border-border px-3.5 py-2.5"
      >
        <slot name="footer" />
      </footer>
    </div>
  </div>
</template>
