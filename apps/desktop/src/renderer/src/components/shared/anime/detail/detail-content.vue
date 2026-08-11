<!--
  Anime Detail Content

  Main content area for the anime detail view.
  Used by both the page and the dialog surface.
-->

<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityIcon } from '@renderer/utils/format'
import AnimeDetailHero from './detail-hero.vue'
import {
  AnimeDetailActivityTab,
  AnimeDetailCharactersTab,
  AnimeDetailEpisodesTab,
  AnimeDetailOverviewTab
} from './tabs'

const { m } = useI18n()

const { anime } = useAnime()
</script>

<template>
  <template v-if="anime">
    <AnimeDetailHero />

    <Tabs default-value="overview">
      <TabsList>
        <TabsTrigger value="overview">
          <Icon
            icon="icon-[mdi--information-outline]"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.overview }}
        </TabsTrigger>
        <TabsTrigger value="episodes">
          <Icon
            icon="icon-[mdi--playlist-play]"
            class="size-3.5"
          />
          {{ m.anime.episodes.title }}
        </TabsTrigger>
        <TabsTrigger value="characters">
          <Icon
            :icon="getEntityIcon('character')"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.characters }}
        </TabsTrigger>
        <TabsTrigger value="activity">
          <Icon
            icon="icon-[mdi--report-timeline-variant]"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.activity }}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <AnimeDetailOverviewTab />
      </TabsContent>
      <TabsContent value="episodes">
        <AnimeDetailEpisodesTab />
      </TabsContent>
      <TabsContent value="characters">
        <AnimeDetailCharactersTab />
      </TabsContent>
      <TabsContent value="activity">
        <AnimeDetailActivityTab />
      </TabsContent>
    </Tabs>
  </template>
</template>
