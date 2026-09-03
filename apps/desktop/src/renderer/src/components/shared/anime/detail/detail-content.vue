<!--
  Anime Detail Content

  Main content area for the anime detail view.
  Used by both the page and the dialog surface.
  Owns the active tab so child tabs can request navigation (e.g. sidebar
  "+N" jumping to the persons/companies tab).
-->

<script setup lang="ts">
import { ref } from 'vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityIcon } from '@renderer/utils/format'
import AnimeDetailHero from './detail-hero.vue'
import {
  AnimeDetailActivityTab,
  AnimeDetailCharactersTab,
  AnimeDetailCompaniesTab,
  AnimeDetailEpisodesTab,
  AnimeDetailNotesTab,
  AnimeDetailOverviewTab,
  AnimeDetailPersonsTab,
  AnimeDetailRelationsTab
} from './tabs'

const { m } = useI18n()

const { anime } = useAnime()

const activeTab = ref('overview')
</script>

<template>
  <template v-if="anime">
    <AnimeDetailHero />

    <Tabs v-model="activeTab">
      <TabsList collapse-below="2xl">
        <TabsTrigger
          value="overview"
          icon="icon-[mdi--information-outline]"
          :label="m.library.detail.tabs.overview"
        />
        <TabsTrigger
          value="episodes"
          icon="icon-[mdi--playlist-play]"
          :label="m.anime.episodes.title"
        />
        <TabsTrigger
          value="characters"
          :icon="getEntityIcon('character')"
          :label="m.library.detail.tabs.characters"
        />
        <TabsTrigger
          value="persons"
          :icon="getEntityIcon('person')"
          :label="m.library.detail.tabs.persons"
        />
        <TabsTrigger
          value="companies"
          :icon="getEntityIcon('company')"
          :label="m.library.detail.tabs.companies"
        />
        <TabsTrigger
          value="relations"
          icon="icon-[mdi--link-variant]"
          :label="m.library.detail.tabs.relatedEntries"
        />
        <TabsTrigger
          value="activity"
          icon="icon-[mdi--report-timeline-variant]"
          :label="m.library.detail.tabs.activity"
        />
        <TabsTrigger
          value="notes"
          icon="icon-[mdi--image-multiple-outline]"
          :label="m.library.detail.tabs.notes"
        />
      </TabsList>

      <TabsContent value="overview">
        <AnimeDetailOverviewTab @navigate="activeTab = $event" />
      </TabsContent>
      <TabsContent value="episodes">
        <AnimeDetailEpisodesTab />
      </TabsContent>
      <TabsContent value="characters">
        <AnimeDetailCharactersTab />
      </TabsContent>
      <TabsContent value="persons">
        <AnimeDetailPersonsTab />
      </TabsContent>
      <TabsContent value="companies">
        <AnimeDetailCompaniesTab />
      </TabsContent>
      <TabsContent value="relations">
        <AnimeDetailRelationsTab />
      </TabsContent>
      <TabsContent value="activity">
        <AnimeDetailActivityTab />
      </TabsContent>
      <TabsContent value="notes">
        <AnimeDetailNotesTab />
      </TabsContent>
    </Tabs>
  </template>
</template>
