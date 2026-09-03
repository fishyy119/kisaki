<!--
  CompanyDetailContent
  Main content area for company detail view.
  Used by both page and dialog modes.
-->
<script setup lang="ts">
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { useCompany } from '@renderer/composables'
import CompanyDetailHero from './detail-hero.vue'
import { CompanyDetailOverviewTab, CompanyDetailWorksTab } from './tabs'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

const { company } = useCompany()
</script>

<template>
  <template v-if="company">
    <!-- Hero section -->
    <CompanyDetailHero />

    <!-- Tabs -->
    <Tabs default-value="overview">
      <TabsList collapse-below="2xl">
        <TabsTrigger
          value="overview"
          icon="icon-[mdi--information-outline]"
          :label="m.library.detail.tabs.overview"
        />
        <TabsTrigger
          value="works"
          icon="icon-[mdi--filmstrip-box-multiple]"
          :label="m.library.detail.tabs.relatedWorks"
        />
      </TabsList>

      <TabsContent value="overview">
        <CompanyDetailOverviewTab />
      </TabsContent>

      <TabsContent value="works">
        <CompanyDetailWorksTab />
      </TabsContent>
    </Tabs>
  </template>
</template>
