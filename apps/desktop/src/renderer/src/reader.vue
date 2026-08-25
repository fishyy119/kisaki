<!-- Reader window shell: pulls the bootstrap and hands off to the engine. -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ReaderBootstrap } from '@shared/reader'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import { useI18n } from '@renderer/composables/use-i18n'
import { createLogger } from '@renderer/core/log'
import { closeReaderWindow, fetchReaderBootstrap } from '@renderer/core/reader/bridge'
import ComicReader from '@renderer/components/reader/comic-reader.vue'
import NovelReader from '@renderer/components/reader/novel-reader.vue'

const log = createLogger('Reader')
const { m } = useI18n()

const bootstrap = ref<ReaderBootstrap | null>(null)
const failed = ref(false)

onMounted(async () => {
  try {
    bootstrap.value = await fetchReaderBootstrap()
  } catch (error) {
    failed.value = true
    log.error('Failed to load the reader bootstrap.', error)
  }
})
</script>

<template>
  <div class="h-full bg-background text-foreground">
    <ComicReader
      v-if="bootstrap?.kind === 'comic'"
      :bootstrap="bootstrap"
    />
    <NovelReader
      v-else-if="bootstrap?.kind === 'novel'"
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
</template>
