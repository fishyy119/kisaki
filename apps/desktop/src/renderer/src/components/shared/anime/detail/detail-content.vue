<!--
  Anime Detail Content

  Main content area for the anime detail view.
  Used by both the page and the dialog surface.
  Owns the active tab so child tabs can request navigation (e.g. sidebar
  "+N" jumping to the persons/companies tab).
-->

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
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
  AnimeDetailPersonsTab
} from './tabs'

const { m } = useI18n()

const { anime } = useAnime()

const activeTab = ref('overview')
</script>

<template>
  <template v-if="anime">
    <AnimeDetailHero />

    <Tabs v-model="activeTab">
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
        <TabsTrigger value="persons">
          <Icon
            :icon="getEntityIcon('person')"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.persons }}
        </TabsTrigger>
        <TabsTrigger value="companies">
          <Icon
            :icon="getEntityIcon('company')"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.companies }}
        </TabsTrigger>
        <TabsTrigger value="activity">
          <Icon
            icon="icon-[mdi--report-timeline-variant]"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.activity }}
        </TabsTrigger>
        <TabsTrigger value="notes">
          <Icon
            icon="icon-[mdi--image-multiple-outline]"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.notes }}
        </TabsTrigger>
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
      <TabsContent value="activity">
        <AnimeDetailActivityTab />
      </TabsContent>
      <TabsContent value="notes">
        <AnimeDetailNotesTab />
      </TabsContent>
    </Tabs>
  </template>
</template>
