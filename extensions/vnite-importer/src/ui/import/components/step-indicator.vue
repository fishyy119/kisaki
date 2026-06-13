<!-- Numbered wizard step header rendered from the host-owned step order. -->
<script setup lang="ts">
interface StepItem {
  key: string
  label: string
}

interface Props {
  steps: readonly StepItem[]
  currentIndex: number
}

const props = defineProps<Props>()
</script>

<template>
  <ol class="flex items-center gap-2 text-xs">
    <li
      v-for="(step, index) in props.steps"
      :key="step.key"
      class="flex items-center gap-2"
    >
      <span
        v-if="index > 0"
        class="h-px w-4 bg-border"
        aria-hidden="true"
      />
      <span
        class="flex items-center gap-1.5"
        :class="
          index === props.currentIndex
            ? 'font-medium text-primary'
            : index < props.currentIndex
              ? 'text-foreground'
              : 'text-muted-foreground'
        "
      >
        <span
          class="flex size-4 items-center justify-center rounded-full border text-[10px] leading-none"
          :class="
            index < props.currentIndex
              ? 'border-primary bg-primary text-primary-foreground'
              : index === props.currentIndex
                ? 'border-primary text-primary'
                : 'border-border'
          "
        >
          <svg
            v-if="index < props.currentIndex"
            class="size-2.5"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M21 7 9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7Z" />
          </svg>
          <template v-else>{{ index + 1 }}</template>
        </span>
        {{ step.label }}
      </span>
    </li>
  </ol>
</template>
