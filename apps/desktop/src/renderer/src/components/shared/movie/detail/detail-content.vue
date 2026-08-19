<!--
  Movie Detail Content

  Main content area for the movie detail view.
  Used by both the page and the dialog surface.
  Owns the active tab so child tabs can request navigation (e.g. sidebar
  "+N" jumping to the persons/characters/companies tab).
-->

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { useI18n } from '@renderer/composables/use-i18n'
import { useMovie } from '@renderer/composables/use-movie'
import { getEntityIcon } from '@renderer/utils/format'
import MovieDetailHero from './detail-hero.vue'
import {
  MovieDetailActivityTab,
  MovieDetailCharactersTab,
  MovieDetailCompaniesTab,
  MovieDetailFilesTab,
  MovieDetailNotesTab,
  MovieDetailOverviewTab,
  MovieDetailPersonsTab,
  MovieDetailRelationsTab
} from './tabs'

const { m } = useI18n()

const { movie } = useMovie()

const activeTab = ref('overview')
</script>

<template>
  <template v-if="movie">
    <MovieDetailHero />

    <Tabs v-model="activeTab">
      <TabsList>
        <TabsTrigger value="overview">
          <Icon
            icon="icon-[mdi--information-outline]"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.overview }}
        </TabsTrigger>
        <TabsTrigger value="files">
          <Icon
            icon="icon-[mdi--filmstrip]"
            class="size-3.5"
          />
          {{ m.movie.files.title }}
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
        <MovieDetailOverviewTab @navigate="activeTab = $event" />
      </TabsContent>
      <TabsContent value="files">
        <MovieDetailFilesTab />
      </TabsContent>
      <TabsContent value="persons">
        <MovieDetailPersonsTab />
      </TabsContent>
      <TabsContent value="characters">
        <MovieDetailCharactersTab />
      </TabsContent>
      <TabsContent value="companies">
        <MovieDetailCompaniesTab />
      </TabsContent>
      <TabsContent value="relations">
        <MovieDetailRelationsTab />
      </TabsContent>
      <TabsContent value="activity">
        <MovieDetailActivityTab />
      </TabsContent>
      <TabsContent value="notes">
        <MovieDetailNotesTab />
      </TabsContent>
    </Tabs>
  </template>
</template>
