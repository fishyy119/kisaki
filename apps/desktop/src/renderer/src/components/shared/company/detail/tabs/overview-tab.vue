<!--
  CompanyDetailOverviewTab
  Overview tab content for company detail dialog.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Section } from '@renderer/components/ui/section'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { GameDetailDialog } from '@renderer/components/shared/game'
import { AnimeDetailDialog } from '@renderer/components/shared/anime'
import { TvDetailDialog } from '@renderer/components/shared/tv'
import { MovieDetailDialog } from '@renderer/components/shared/movie'
import { TagCard, TagDetailDialog } from '@renderer/components/shared/tag'
import { useCompany } from '@renderer/composables'
import {
  EntityDescriptionFormDialog,
  EntityExternalSitesFormDialog,
  EntityTagsFormDialog,
  EntityWorksSection
} from '@renderer/components/shared/entity'
import { useI18n } from '@renderer/composables'
import type { MediaType } from '@shared/common'
import { useCompanyWorksBlocks } from '../works'

const { m } = useI18n()

const { company, tags } = useCompany()
const worksBlocks = useCompanyWorksBlocks()

// Edit dialog states
const descriptionDialogOpen = ref(false)
const sitesDialogOpen = ref(false)
const tagsDialogOpen = ref(false)

// Detail dialog states
const openWork = ref<{ mediaType: MediaType; id: string } | null>(null)
const openTagId = ref<string | null>(null)

const workDialogOpen = computed({
  get: () => openWork.value !== null,
  set: (value) => {
    if (!value) openWork.value = null
  }
})

const hasExternalSites = computed(
  () => company.value?.externalSites && company.value.externalSites.length > 0
)
const hasTags = computed(() => tags.value && tags.value.length > 0)

const tagDialogOpen = computed({
  get: () => openTagId.value !== null,
  set: (value) => {
    if (!value) openTagId.value = null
  }
})
</script>

<template>
  <template v-if="company">
    <div class="grid md:grid-cols-[3fr_1fr] grid-cols-1 gap-8">
      <!-- Left column: Description, Works, Tags -->
      <div class="space-y-6 min-w-0">
        <Section
          :title="m.library.detail.sections.description"
          editable
          :empty="!company.description"
          :empty-text="m.library.detail.empty.description"
          @edit="descriptionDialogOpen = true"
        >
          <MarkdownContent :content="company.description!" />
        </Section>

        <EntityWorksSection
          :blocks="worksBlocks"
          @open="(mediaType, id) => (openWork = { mediaType, id })"
        />

        <Section
          :title="m.library.fields.tags"
          editable
          :empty="!hasTags"
          :empty-text="m.library.detail.empty.tags"
          @edit="tagsDialogOpen = true"
        >
          <div class="flex flex-wrap gap-1">
            <template
              v-for="tagLink in tags"
              :key="tagLink.id"
            >
              <TagCard
                v-if="tagLink.tag"
                :tag="tagLink.tag"
                variant="button"
                button-size="xs"
                @click="openTagId = tagLink.tag.id"
              />
            </template>
          </div>
        </Section>
      </div>

      <!-- Right column: Related Sites -->
      <div class="space-y-6 min-w-0">
        <Section
          :title="m.library.fields.externalSites"
          editable
          :empty="!hasExternalSites"
          :empty-text="m.library.detail.empty.externalSites"
          @edit="sitesDialogOpen = true"
        >
          <div class="flex flex-col gap-1.5">
            <a
              v-for="(site, index) in company.externalSites"
              :key="index"
              :href="site.url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Icon
                icon="icon-[mdi--open-in-new]"
                class="size-3.5"
              />
              {{ site.label }}
            </a>
          </div>
        </Section>
      </div>
    </div>

    <!-- Edit Dialogs -->
    <EntityDescriptionFormDialog
      v-if="descriptionDialogOpen"
      v-model:open="descriptionDialogOpen"
      entity-type="company"
      :entity-id="company.id"
    />
    <EntityExternalSitesFormDialog
      v-if="sitesDialogOpen"
      v-model:open="sitesDialogOpen"
      entity-type="company"
      :entity-id="company.id"
    />
    <EntityTagsFormDialog
      v-if="tagsDialogOpen"
      v-model:open="tagsDialogOpen"
      entity-type="company"
      :entity-id="company.id"
    />

    <!-- Entity Dialogs -->
    <template v-if="openWork">
      <GameDetailDialog
        v-if="openWork.mediaType === 'game'"
        v-model:open="workDialogOpen"
        :game-id="openWork.id"
      />
      <AnimeDetailDialog
        v-else-if="openWork.mediaType === 'anime'"
        v-model:open="workDialogOpen"
        :anime-id="openWork.id"
      />
      <TvDetailDialog
        v-else-if="openWork.mediaType === 'tv'"
        v-model:open="workDialogOpen"
        :tv-id="openWork.id"
      />
      <MovieDetailDialog
        v-else
        v-model:open="workDialogOpen"
        :movie-id="openWork.id"
      />
    </template>

    <!-- Tag Detail Dialog -->
    <TagDetailDialog
      v-if="openTagId"
      v-model:open="tagDialogOpen"
      :tag-id="openTagId"
    />
  </template>
</template>
