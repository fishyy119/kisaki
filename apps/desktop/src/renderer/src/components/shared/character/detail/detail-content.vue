<!--
  Character Detail Content

  Main content area for character detail view.
  Used by both page and dialog modes.
-->

<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { useCharacter } from '@renderer/composables/use-character'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { getEntityIcon } from '@renderer/utils/format'
import CharacterDetailHero from './detail-hero.vue'
import {
  CharacterDetailOverviewTab,
  CharacterDetailPersonsTab,
  CharacterDetailGamesTab
} from './tabs'

// =============================================================================
// State
// =============================================================================

const { character } = useCharacter()
</script>

<template>
  <template v-if="character">
    <!-- Hero section -->
    <CharacterDetailHero />

    <!-- Tabs -->
    <Tabs default-value="overview">
      <TabsList>
        <TabsTrigger value="overview">
          <Icon
            icon="icon-[mdi--information-outline]"
            class="size-3.5"
          />
          概览
        </TabsTrigger>
        <TabsTrigger value="persons">
          <Icon
            :icon="getEntityIcon('person')"
            class="size-3.5"
          />
          相关人物
        </TabsTrigger>
        <TabsTrigger value="games">
          <Icon
            :icon="getEntityIcon('game')"
            class="size-3.5"
          />
          相关游戏
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <CharacterDetailOverviewTab />
      </TabsContent>
      <TabsContent value="persons">
        <CharacterDetailPersonsTab />
      </TabsContent>
      <TabsContent value="games">
        <CharacterDetailGamesTab />
      </TabsContent>
    </Tabs>
  </template>
</template>
