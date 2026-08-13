<!--
  Game Detail Content

  Main content area for game detail view.
  Used by both page and dialog modes.
  Owns the active tab so child tabs can request navigation (e.g. sidebar
  "+N" jumping to the persons/companies tab).
-->

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { useGame } from '@renderer/composables/use-game'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { getEntityIcon } from '@renderer/utils/format'
import GameDetailHero from './detail-hero.vue'
import {
  GameDetailOverviewTab,
  GameDetailCharactersTab,
  GameDetailPersonsTab,
  GameDetailCompaniesTab,
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
      <TabsList>
        <TabsTrigger value="overview">
          <Icon
            icon="icon-[mdi--information-outline]"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.overview }}
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
        <TabsTrigger value="saves">
          <Icon
            icon="icon-[mdi--content-save-outline]"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.saves }}
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
