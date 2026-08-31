<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Separator } from '@renderer/components/ui/separator'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'

interface Props {
  readonly?: boolean
  canAttach?: boolean
  showPreview?: boolean
  showFullscreen?: boolean
  showExitFullscreen?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  canAttach: false,
  showPreview: false,
  showFullscreen: false,
  showExitFullscreen: false
})

const emit = defineEmits<{
  wrapSelection: [prefix: string, suffix: string]
  insertBlock: [block: string]
  prefixSelectedLines: [prefix: string]
  insertHeading: [level: 1 | 2 | 3 | 4 | 5 | 6]
  insertLink: []
  insertImageSyntax: []
  insertTable: []
  insertFootnote: []
  attachImage: []
  preview: []
  fullscreen: []
  exitFullscreen: []
}>()

const { m } = useI18n()
</script>

<template>
  <div :class="cn('flex items-center border-b border-border bg-muted/30 px-1.5 py-1', props.class)">
    <div class="flex flex-wrap items-center gap-1">
      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.bold"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('wrapSelection', '**', '**')"
      >
        <Icon
          icon="icon-[mdi--format-bold]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.italic"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('wrapSelection', '*', '*')"
      >
        <Icon
          icon="icon-[mdi--format-italic]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.strikethrough"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('wrapSelection', '~~', '~~')"
      >
        <Icon
          icon="icon-[mdi--format-strikethrough]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.inlineCode"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('wrapSelection', '`', '`')"
      >
        <Icon
          icon="icon-[mdi--code-tags]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.codeBlock"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('insertBlock', '```\\n\\n```')"
      >
        <Icon
          icon="icon-[mdi--code-braces]"
          class="size-4"
        />
      </Button>

      <Separator
        orientation="vertical"
        class="mx-1 h-4"
      />

      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.link"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('insertLink')"
      >
        <Icon
          icon="icon-[mdi--link-variant]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.imageSyntax"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('insertImageSyntax')"
      >
        <Icon
          icon="icon-[mdi--image-outline]"
          class="size-4"
        />
      </Button>

      <Separator
        orientation="vertical"
        class="mx-1 h-4"
      />

      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.heading1"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('insertHeading', 1)"
      >
        <Icon
          icon="icon-[mdi--format-header-1]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.heading2"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('insertHeading', 2)"
      >
        <Icon
          icon="icon-[mdi--format-header-2]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.quote"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('prefixSelectedLines', '> ')"
      >
        <Icon
          icon="icon-[mdi--format-quote-close]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.bulletedList"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('prefixSelectedLines', '- ')"
      >
        <Icon
          icon="icon-[mdi--format-list-bulleted]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.numberedList"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('prefixSelectedLines', '1. ')"
      >
        <Icon
          icon="icon-[mdi--format-list-numbered]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.taskList"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('prefixSelectedLines', '- [ ] ')"
      >
        <Icon
          icon="icon-[mdi--checkbox-marked-outline]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.table"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('insertTable')"
      >
        <Icon
          icon="icon-[mdi--table]"
          class="size-4"
        />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.footnote"
        type="button"
        :disabled="props.readonly"
        @click.prevent="emit('insertFootnote')"
      >
        <Icon
          icon="icon-[mdi--comment-edit-outline]"
          class="size-4"
        />
      </Button>

      <template v-if="props.canAttach">
        <Separator
          orientation="vertical"
          class="mx-1 h-4"
        />
        <Button
          variant="ghost"
          size="icon-xs"
          :title="m.ui.markdown.toolbar.attachImage"
          type="button"
          :disabled="props.readonly"
          @click.prevent="emit('attachImage')"
        >
          <Icon
            icon="icon-[mdi--image-plus-outline]"
            class="size-4"
          />
        </Button>
      </template>
    </div>

    <div class="ml-auto flex items-center gap-1 pl-1">
      <Button
        v-if="props.showPreview"
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.preview"
        type="button"
        @click.prevent="emit('preview')"
      >
        <Icon
          icon="icon-[mdi--eye-outline]"
          class="size-4"
        />
      </Button>
      <Button
        v-if="props.showFullscreen"
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.fullscreen"
        type="button"
        @click.prevent="emit('fullscreen')"
      >
        <Icon
          icon="icon-[mdi--fullscreen]"
          class="size-4"
        />
      </Button>
      <Button
        v-if="props.showExitFullscreen"
        variant="ghost"
        size="icon-xs"
        :title="m.ui.markdown.toolbar.exitFullscreen"
        type="button"
        @click.prevent="emit('exitFullscreen')"
      >
        <Icon
          icon="icon-[mdi--fullscreen-exit]"
          class="size-4"
        />
      </Button>
    </div>
  </div>
</template>
