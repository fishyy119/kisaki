<!--
  Comic Detail Content

  Main content area for the comic detail view.
  Used by both the page and the dialog surface.
  Owns the active tab so child tabs can request navigation (e.g. sidebar
  "+N" jumping to the persons/companies tab).
-->

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
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
      <TabsList>
        <TabsTrigger value="overview">
          <Icon
            icon="icon-[mdi--information-outline]"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.overview }}
        </TabsTrigger>
        <TabsTrigger value="chapters">
          <Icon
            icon="icon-[mdi--thought-bubble-outline]"
            class="size-3.5"
          />
          {{ m.comic.chapters.title }}
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
