<!-- Settings/workflow section header with compact Kisaki desktop rhythm. -->
<script setup lang="ts">
type SettingsSectionSurface = 'plain' | 'rows'

interface Props {
  title: string
  description?: string
  surface?: SettingsSectionSurface
}

const props = withDefaults(defineProps<Props>(), {
  surface: 'plain'
})

const rowsSurfaceClass = [
  'overflow-hidden rounded-md border border-border',
  '[&>[data-slot=field-group]]:gap-0',
  '[&>[data-slot=field-group]]:divide-y',
  '[&>[data-slot=field-group]]:divide-border',
  '[&>[data-slot=field-group]>[data-slot=field]]:px-3',
  '[&>[data-slot=field-group]>[data-slot=field]]:py-2.5'
]
</script>

<template>
  <section class="space-y-2">
    <header class="flex min-w-0 items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-sm font-medium">{{ props.title }}</h2>
        <p
          v-if="props.description"
          class="mt-0.5 text-xs text-muted-foreground"
        >
          {{ props.description }}
        </p>
      </div>
      <slot name="actions" />
    </header>
    <div
      v-if="props.surface === 'rows'"
      :class="rowsSurfaceClass"
    >
      <slot />
    </div>
    <slot v-else />
  </section>
</template>
