<!--
  CompanyDetailContent
  Main content area for company detail view.
  Used by both page and dialog modes.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
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
      <TabsList>
        <TabsTrigger value="overview">
          <Icon
            icon="icon-[mdi--information-outline]"
            class="size-3.5"
          />
          {{ m.library.detail.tabs.overview }}
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
        <CompanyDetailOverviewTab />
      </TabsContent>

      <TabsContent value="works">
        <CompanyDetailWorksTab />
      </TabsContent>
    </Tabs>
  </template>
</template>
