<!--
  Game Detail Content

  Main content area for game detail view.
  Used by both page and dialog modes.
  Owns the active tab so child tabs can request navigation (e.g. sidebar
  "+N" jumping to the persons/companies tab).
-->

<script setup lang="ts">
import { ref } from 'vue'
import { useGame } from '@renderer/composables/use-game'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { getEntityIcon } from '@renderer/utils/format'
import GameDetailHero from './detail-hero.vue'
import {
  GameDetailOverviewTab,
  GameDetailCharactersTab,
  GameDetailPersonsTab,
  GameDetailCompaniesTab,
  GameDetailRelationsTab,
  GameDetailActivityTab,
  GameDetailSavesTab,
  GameDetailNotesTab
} from './tabs'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

const { game } = useGame()

const activeTab = ref('overview')
</script>

<template>
  <template v-if="game">
    <!-- Hero section -->
    <GameDetailHero />

    <!-- Tabs -->
    <Tabs v-model="activeTab">
      <TabsList collapse-below="2xl">
        <TabsTrigger
          value="overview"
          icon="icon-[mdi--information-outline]"
          :label="m.library.detail.tabs.overview"
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
          value="saves"
          icon="icon-[mdi--content-save-outline]"
          :label="m.library.detail.tabs.saves"
        />
        <TabsTrigger
          value="notes"
          icon="icon-[mdi--image-multiple-outline]"
          :label="m.library.detail.tabs.notes"
        />
      </TabsList>

      <TabsContent value="overview">
        <GameDetailOverviewTab @navigate="activeTab = $event" />
      </TabsContent>
      <TabsContent value="characters">
        <GameDetailCharactersTab />
      </TabsContent>
      <TabsContent value="persons">
        <GameDetailPersonsTab />
      </TabsContent>
      <TabsContent value="companies">
        <GameDetailCompaniesTab />
      </TabsContent>
      <TabsContent value="relations">
        <GameDetailRelationsTab />
      </TabsContent>
      <TabsContent value="activity">
        <GameDetailActivityTab />
      </TabsContent>
      <TabsContent value="saves">
        <GameDetailSavesTab />
      </TabsContent>
      <TabsContent value="notes">
        <GameDetailNotesTab />
      </TabsContent>
    </Tabs>
  </template>
</template>
