<!--
  Tv Detail Content

  Main content area for the series detail view.
  Used by both the page and the dialog surface.
  Owns the active tab so child tabs can request navigation (e.g. sidebar
  "+N" jumping to the persons/characters/companies tab).
-->

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { useI18n } from '@renderer/composables/use-i18n'
import { useTv } from '@renderer/composables/use-tv'
import { getEntityIcon } from '@renderer/utils/format'
import TvDetailHero from './detail-hero.vue'
import {
  TvDetailActivityTab,
  TvDetailCharactersTab,
  TvDetailCompaniesTab,
  TvDetailEpisodesTab,
  TvDetailNotesTab,
  TvDetailOverviewTab,
  TvDetailPersonsTab,
  TvDetailRelationsTab
} from './tabs'

const { m } = useI18n()

const { tv } = useTv()

const activeTab = ref('overview')
</script>

<template>
  <template v-if="tv">
    <TvDetailHero />

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
          {{ m.tv.episodes.title }}
        </TabsTrigger>
        <TabsTrigger value="persons">
          <Icon
            :icon="getEntityIcon('person')"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.persons }}
        </TabsTrigger>
        <TabsTrigger value="characters">
          <Icon
            :icon="getEntityIcon('character')"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.characters }}
        </TabsTrigger>
        <TabsTrigger value="companies">
          <Icon
            :icon="getEntityIcon('company')"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.companies }}
        </TabsTrigger>
        <TabsTrigger value="relations">
          <Icon
            icon="icon-[mdi--link-variant]"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.relatedEntries }}
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
        <TvDetailOverviewTab @navigate="activeTab = $event" />
      </TabsContent>
      <TabsContent value="episodes">
        <TvDetailEpisodesTab />
      </TabsContent>
      <TabsContent value="persons">
        <TvDetailPersonsTab />
      </TabsContent>
      <TabsContent value="characters">
        <TvDetailCharactersTab />
      </TabsContent>
      <TabsContent value="companies">
        <TvDetailCompaniesTab />
      </TabsContent>
      <TabsContent value="relations">
        <TvDetailRelationsTab />
      </TabsContent>
      <TabsContent value="activity">
        <TvDetailActivityTab />
      </TabsContent>
      <TabsContent value="notes">
        <TvDetailNotesTab />
      </TabsContent>
    </Tabs>
  </template>
</template>
