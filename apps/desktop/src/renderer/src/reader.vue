<!-- Reader window shell: pulls the bootstrap and hands off to the engine. -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { ReaderBootstrap } from '@shared/reader'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import { Toaster } from '@renderer/components/ui/toaster'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { useI18n } from '@renderer/composables/use-i18n'
import { createLogger } from '@renderer/core/log'
import {
  closeReaderWindow,
  fetchReaderBootstrap,
  onReaderNavigate
} from '@renderer/core/reader/bridge'
import ComicReader from '@renderer/components/reader/comic-reader.vue'
import NovelReader from '@renderer/components/reader/novel-reader.vue'

const log = createLogger('Reader')
const { m } = useI18n()

const bootstrap = ref<ReaderBootstrap | null>(null)
const failed = ref(false)

let stopNavigate: (() => void) | null = null

onMounted(async () => {
  // Subscribed before the first fetch so a re-aim during startup is not lost.
  stopNavigate = onReaderNavigate((next) => {
    bootstrap.value = next
    failed.value = false
  })

  try {
    bootstrap.value = await fetchReaderBootstrap()
  } catch (error) {
    failed.value = true
    log.error('Failed to load the reader bootstrap.', error)
  }
})

onBeforeUnmount(() => {
  stopNavigate?.()
  stopNavigate = null
})
</script>

<template>
  <TooltipProvider>
    <div class="h-full bg-background text-foreground">
      <ComicReader
        v-if="bootstrap?.media === 'comic'"
        :bootstrap="bootstrap"
      />
      <NovelReader
        v-else-if="bootstrap?.media === 'novel'"
        :bootstrap="bootstrap"
      />

      <div
        v-else
        class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground"
      >
        <template v-if="failed">
          <span class="text-sm">{{ m.reader.loadFailed }}</span>
          <Button
            variant="outline"
            size="sm"
            @click="closeReaderWindow"
          >
            {{ m.reader.close }}
          </Button>
        </template>
        <template v-else>
          <Spinner class="size-5" />
          <span class="text-sm">{{ m.reader.loading }}</span>
        </template>
      </div>
    </div>

    <Toaster />
  </TooltipProvider>
</template>
