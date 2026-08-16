<!--
  PersonDetailContent
  Main content area for person detail view.
  Used by both page and dialog modes.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
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
          {{ m.library.detail.tabs.relatedCharacters }}
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
