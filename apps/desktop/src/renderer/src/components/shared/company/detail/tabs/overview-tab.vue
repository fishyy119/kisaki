<!--
  CompanyDetailOverviewTab
  Overview tab content for company detail dialog.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Section, SectionScroll } from '@renderer/components/ui/section'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { GameCard, GameDetailDialog } from '@renderer/components/shared/game'
import { AnimeCard, AnimeDetailDialog } from '@renderer/components/shared/anime'
import { TagCard, TagDetailDialog } from '@renderer/components/shared/tag'
import { useCompany } from '@renderer/composables'
import {
  EntityDescriptionFormDialog,
  EntityLinksFormDialog,
  EntityExternalSitesFormDialog,
  EntityTagsFormDialog
} from '@renderer/components/shared/entity'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

const GAME_COMPANY_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.gameCompany
)

const ANIME_COMPANY_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.animeCompany
)

const { company, tags, games, animes } = useCompany()

// Edit dialog states
const descriptionDialogOpen = ref(false)
const sitesDialogOpen = ref(false)
const tagsDialogOpen = ref(false)
const gamesDialogOpen = ref(false)
const animesDialogOpen = ref(false)

// Detail dialog states
const openGameId = ref<string | null>(null)
const openAnimeId = ref<string | null>(null)
const openTagId = ref<string | null>(null)

const gameDialogOpen = computed({
  get: () => openGameId.value !== null,
  set: (value) => {
    if (!value) openGameId.value = null
  }
})

const animeDialogOpen = computed({
  get: () => openAnimeId.value !== null,
  set: (value) => {
    if (!value) openAnimeId.value = null
  }
})

const hasExternalSites = computed(
  () => company.value?.externalSites && company.value.externalSites.length > 0
)
const hasTags = computed(() => tags.value && tags.value.length > 0)

const gameLinks = computed(() => games.value.filter((link) => link.game))
const animeLinks = computed(() => animes.value.filter((link) => link.anime))

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
      <!-- Left column: Description, Related Games, Tags -->
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

        <SectionScroll
          :title="m.library.fields.relatedGames"
          editable
          :items="gameLinks"
          :get-key="(item) => item.id"
          :empty-text="m.library.detail.empty.relatedGames"
          @edit="gamesDialogOpen = true"
        >
          <template #item="{ item: link }">
            <GameCard
              :game="link.game!"
              align="left"
              size="sm"
              :badge-label="link.role ? GAME_COMPANY_ROLE_LABELS[link.role] : undefined"
              @click="openGameId = link.game!.id"
            />
          </template>
        </SectionScroll>

        <SectionScroll
          :title="m.library.fields.relatedAnimes"
          editable
          :items="animeLinks"
          :get-key="(item) => item.id"
          :empty-text="m.library.detail.empty.relatedAnimes"
          @edit="animesDialogOpen = true"
        >
          <template #item="{ item: link }">
            <AnimeCard
              :anime="link.anime!"
              align="left"
              size="sm"
              :badge-label="link.role ? ANIME_COMPANY_ROLE_LABELS[link.role] : undefined"
              @click="openAnimeId = link.anime!.id"
            />
          </template>
        </SectionScroll>

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
    <EntityLinksFormDialog
      v-if="gamesDialogOpen"
      v-model:open="gamesDialogOpen"
      view="company-games"
      :entity-id="company.id"
    />
    <EntityLinksFormDialog
      v-if="animesDialogOpen"
      v-model:open="animesDialogOpen"
      view="company-animes"
      :entity-id="company.id"
    />

    <!-- Entity Dialogs -->
    <GameDetailDialog
      v-if="openGameId"
      v-model:open="gameDialogOpen"
      :game-id="openGameId"
    />
    <AnimeDetailDialog
      v-if="openAnimeId"
      v-model:open="animeDialogOpen"
      :anime-id="openAnimeId"
    />

    <!-- Tag Detail Dialog -->
    <TagDetailDialog
      v-if="openTagId"
      v-model:open="tagDialogOpen"
      :tag-id="openTagId"
    />
  </template>
</template>
