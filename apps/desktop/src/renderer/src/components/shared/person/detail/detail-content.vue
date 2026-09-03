<!--
  PersonDetailContent
  Main content area for person detail view.
  Used by both page and dialog modes.
-->
<script setup lang="ts">
import { usePerson } from '@renderer/composables/use-person'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { getEntityIcon } from '@renderer/utils/format'
import PersonDetailHero from './detail-hero.vue'
import { PersonDetailOverviewTab, PersonDetailWorksTab, PersonDetailCharactersTab } from './tabs'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

const { person } = usePerson()
</script>

<template>
  <template v-if="person">
    <!-- Hero section -->
    <PersonDetailHero />

    <!-- Tabs -->
    <Tabs default-value="overview">
      <TabsList collapse-below="2xl">
        <TabsTrigger
          value="overview"
          icon="icon-[mdi--information-outline]"
          :label="m.library.detail.tabs.overview"
        />
        <TabsTrigger
          value="characters"
          :icon="getEntityIcon('character')"
          :label="m.library.detail.tabs.relatedCharacters"
        />
        <TabsTrigger
          value="works"
          icon="icon-[mdi--filmstrip-box-multiple]"
          :label="m.library.detail.tabs.relatedWorks"
        />
      </TabsList>

      <TabsContent value="overview">
        <PersonDetailOverviewTab />
      </TabsContent>
      <TabsContent value="characters">
        <PersonDetailCharactersTab />
      </TabsContent>
      <TabsContent value="works">
        <PersonDetailWorksTab />
      </TabsContent>
    </Tabs>
  </template>
</template>
