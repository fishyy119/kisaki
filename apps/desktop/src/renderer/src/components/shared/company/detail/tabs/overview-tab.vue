<!--
  CompanyDetailOverviewTab
  Overview tab content for company detail dialog.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Section } from '@renderer/components/ui/section'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { TagCard } from '@renderer/components/shared/tag'
import { useCompany } from '@renderer/composables'
import {
  EntityDescriptionFormDialog,
  EntityDetailDialog,
  EntityExternalSitesFormDialog,
  EntityTagsFormDialog,
  EntityWorksSection,
  type EntityDetailTarget
} from '@renderer/components/shared/entity'
import { useI18n } from '@renderer/composables'
import { COMPANY_RELATION_TYPES } from '@shared/db'
import { CompanyRelationsFormDialog } from '../../relations'
import { useCompanyWorksBlocks } from '../works'

const { m } = useI18n()

const { company, tags, relations } = useCompany()
const worksBlocks = useCompanyWorksBlocks()

// Edit dialog states
const descriptionDialogOpen = ref(false)
const sitesDialogOpen = ref(false)
const tagsDialogOpen = ref(false)
const relationsDialogOpen = ref(false)

/** The entity whose detail dialog is open, if any */
const openEntity = ref<EntityDetailTarget | null>(null)

const hasExternalSites = computed(
  () => company.value?.externalSites && company.value.externalSites.length > 0
)
const hasTags = computed(() => tags.value && tags.value.length > 0)
const hasRelations = computed(() => relations.value.length > 0)

const RELATION_TYPE_LABELS = computed<Record<string, string>>(() => m.value.library.companyRelation)

/** Grouped by relation type so a house reads as its own structure. */
const relationGroups = computed(() =>
  COMPANY_RELATION_TYPES.map((type) => ({
    type,
    items: relations.value.filter((relation) => relation.type === type)
  })).filter((group) => group.items.length > 0)
)
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
          @open="(mediaType, id) => (openEntity = { entityType: mediaType, entityId: id })"
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
                @click="openEntity = { entityType: 'tag', entityId: tagLink.tag.id }"
              />
            </template>
          </div>
        </Section>
      </div>

      <!-- Right column: Company Relations, Related Sites -->
      <div class="space-y-6 min-w-0">
        <Section
          :title="m.library.fields.companyRelations"
          editable
          :empty="!hasRelations"
          :empty-text="m.library.detail.empty.companyRelations"
          @edit="relationsDialogOpen = true"
        >
          <div class="space-y-3">
            <div
              v-for="group in relationGroups"
              :key="group.type"
            >
              <h4 class="text-xs font-medium text-muted-foreground mb-1">
                {{ RELATION_TYPE_LABELS[group.type] }}
              </h4>
              <div class="flex flex-col gap-1 text-sm">
                <button
                  v-for="relation in group.items"
                  :key="relation.id"
                  type="button"
                  class="text-left text-primary hover:underline truncate"
                  @click="openEntity = { entityType: 'company', entityId: relation.company.id }"
                >
                  {{ relation.company.name }}
                </button>
              </div>
            </div>
          </div>
        </Section>

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
    <CompanyRelationsFormDialog
      v-if="relationsDialogOpen"
      v-model:open="relationsDialogOpen"
      :company-id="company.id"
    />

    <!-- Entity Detail Dialog -->
    <EntityDetailDialog v-model:target="openEntity" />
  </template>
</template>
