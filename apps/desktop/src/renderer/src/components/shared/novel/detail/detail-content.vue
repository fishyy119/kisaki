<!--
  Novel Detail Content

  Main content area for the novel detail view.
  Used by both the page and the dialog surface.
  Owns the active tab so child tabs can request navigation (e.g. sidebar
  "+N" jumping to the persons/companies tab).
-->

<script setup lang="ts">
import { ref } from 'vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { useNovel } from '@renderer/composables/use-novel'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityIcon } from '@renderer/utils/format'
import NovelDetailHero from './detail-hero.vue'
import {
  NovelDetailActivityTab,
  NovelDetailCharactersTab,
  NovelDetailCompaniesTab,
  NovelDetailNotesTab,
  NovelDetailOverviewTab,
  NovelDetailPersonsTab,
  NovelDetailRelationsTab,
  NovelDetailVolumesTab
} from './tabs'

const { m } = useI18n()

const { novel } = useNovel()

const activeTab = ref('overview')
</script>

<template>
  <template v-if="novel">
    <NovelDetailHero />

    <Tabs v-model="activeTab">
      <TabsList collapse-below="2xl">
        <TabsTrigger
          value="overview"
          icon="icon-[mdi--information-outline]"
          :label="m.library.detail.tabs.overview"
        />
        <TabsTrigger
          value="volumes"
          icon="icon-[mdi--book-open-blank-variant-outline]"
          :label="m.novel.volumes.title"
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
        <NovelDetailOverviewTab @navigate="activeTab = $event" />
      </TabsContent>
      <TabsContent value="volumes">
        <NovelDetailVolumesTab />
      </TabsContent>
      <TabsContent value="characters">
        <NovelDetailCharactersTab />
      </TabsContent>
      <TabsContent value="persons">
        <NovelDetailPersonsTab />
      </TabsContent>
      <TabsContent value="companies">
        <NovelDetailCompaniesTab />
      </TabsContent>
      <TabsContent value="relations">
        <NovelDetailRelationsTab />
      </TabsContent>
      <TabsContent value="activity">
        <NovelDetailActivityTab />
      </TabsContent>
      <TabsContent value="notes">
        <NovelDetailNotesTab />
      </TabsContent>
    </Tabs>
  </template>
</template>
