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
  CharacterDetailWorksTab
} from './tabs'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

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
          {{ m.library.detail.tabs.overview }}
        </TabsTrigger>
        <TabsTrigger value="persons">
          <Icon
            :icon="getEntityIcon('person')"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.relatedPersons }}
        </TabsTrigger>
        <TabsTrigger value="works">
          <Icon
            icon="icon-[mdi--filmstrip-box-multiple]"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.relatedWorks }}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <CharacterDetailOverviewTab />
      </TabsContent>
      <TabsContent value="persons">
        <CharacterDetailPersonsTab />
      </TabsContent>
      <TabsContent value="works">
        <CharacterDetailWorksTab />
      </TabsContent>
    </Tabs>
  </template>
</template>
