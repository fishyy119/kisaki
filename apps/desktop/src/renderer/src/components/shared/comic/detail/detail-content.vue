<!--
  Comic Detail Content

  Main content area for the comic detail view.
  Used by both the page and the dialog surface.
  Owns the active tab so child tabs can request navigation (e.g. sidebar
  "+N" jumping to the persons/companies tab).
-->

<script setup lang="ts">
import { ref } from 'vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { useComic } from '@renderer/composables/use-comic'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityIcon } from '@renderer/utils/format'
import ComicDetailHero from './detail-hero.vue'
import {
  ComicDetailActivityTab,
  ComicDetailChaptersTab,
  ComicDetailCharactersTab,
  ComicDetailCompaniesTab,
  ComicDetailNotesTab,
  ComicDetailOverviewTab,
  ComicDetailPersonsTab,
  ComicDetailRelationsTab
} from './tabs'

const { m } = useI18n()

const { comic } = useComic()

const activeTab = ref('overview')
</script>

<template>
  <template v-if="comic">
    <ComicDetailHero />

    <Tabs v-model="activeTab">
      <TabsList collapse-below="2xl">
        <TabsTrigger
          value="overview"
          icon="icon-[mdi--information-outline]"
          :label="m.library.detail.tabs.overview"
        />
        <TabsTrigger
          value="chapters"
          icon="icon-[mdi--thought-bubble-outline]"
          :label="m.comic.chapters.title"
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
        <ComicDetailOverviewTab @navigate="activeTab = $event" />
      </TabsContent>
      <TabsContent value="chapters">
        <ComicDetailChaptersTab />
      </TabsContent>
      <TabsContent value="characters">
        <ComicDetailCharactersTab />
      </TabsContent>
      <TabsContent value="persons">
        <ComicDetailPersonsTab />
      </TabsContent>
      <TabsContent value="companies">
        <ComicDetailCompaniesTab />
      </TabsContent>
      <TabsContent value="relations">
        <ComicDetailRelationsTab />
      </TabsContent>
      <TabsContent value="activity">
        <ComicDetailActivityTab />
      </TabsContent>
      <TabsContent value="notes">
        <ComicDetailNotesTab />
      </TabsContent>
    </Tabs>
  </template>
</template>
