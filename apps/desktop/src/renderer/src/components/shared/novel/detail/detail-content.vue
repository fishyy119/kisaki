<!--
  Novel Detail Content

  Main content area for the novel detail view.
  Used by both the page and the dialog surface.
  Owns the active tab so child tabs can request navigation (e.g. sidebar
  "+N" jumping to the persons/companies tab).
-->

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
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
      <TabsList>
        <TabsTrigger value="overview">
          <Icon
            icon="icon-[mdi--information-outline]"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.overview }}
        </TabsTrigger>
        <TabsTrigger value="volumes">
          <Icon
            icon="icon-[mdi--book-open-blank-variant-outline]"
            class="size-3.5"
          />
          {{ m.novel.volumes.title }}
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
