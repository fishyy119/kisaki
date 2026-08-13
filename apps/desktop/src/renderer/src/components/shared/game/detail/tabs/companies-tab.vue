<!--
  Game Companies Tab

  Companies tab content showing game companies grouped by role.
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { useGame } from '@renderer/composables/use-game'
import { getEntityIcon } from '@renderer/utils/format'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { CompanyCard, CompanyDetailDialog } from '@renderer/components/shared/company'
import { useI18n } from '@renderer/composables'
import { EntityLinksFormDialog } from '@renderer/components/shared/entity'
import { GAME_COMPANY_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()

// =============================================================================
// Constants
// =============================================================================

const COMPANY_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.gameCompany
)

// =============================================================================
// State
// =============================================================================

const { game, companies } = useGame()

const editDialogOpen = ref(false)
const openCompanyId = ref<string | null>(null)

// =============================================================================
// Computed
// =============================================================================

const hasCompanies = computed(() => companies.value && companies.value.length > 0)

/** Group companies by type */
const groupedCompanies = computed(() => {
  if (!hasCompanies.value) return {}
  return companies.value.reduce(
    (acc, link) => {
      const role = link.role || 'other'
      if (!acc[role]) acc[role] = []
      acc[role].push(link)
      return acc
    },
    {} as Record<string, typeof companies.value>
  )
})

const companyDialogOpen = computed({
  get: () => openCompanyId.value !== null,
  set: (value) => {
    if (!value) openCompanyId.value = null
  }
})
</script>

<template>
  <template v-if="game">
    <!-- Empty state -->
    <StateView
      v-if="!hasCompanies"
      state="empty"
      :icon="getEntityIcon('company')"
      :description="m.library.detail.empty.companies"
      class="py-12"
    >
      <template #actions>
        <Button
          variant="outline"
          size="sm"
          @click="editDialogOpen = true"
        >
          <Icon
            icon="icon-[mdi--plus]"
            class="size-4 mr-1.5"
          />
          {{ m.library.detail.addEntity({ label: m.library.entities.company }) }}
        </Button>
      </template>
    </StateView>

    <!-- Companies list -->
    <template v-else>
      <!-- Header with manage button -->
      <div class="flex items-center justify-start mb-4">
        <Button
          variant="outline"
          size="sm"
          @click="editDialogOpen = true"
        >
          <Icon
            icon="icon-[mdi--pencil-outline]"
            class="size-4 mr-1.5"
          />
          {{ m.library.detail.manage }}
        </Button>
      </div>

      <div class="space-y-4">
        <template
          v-for="role in GAME_COMPANY_ROLE_VALUES"
          :key="role"
        >
          <div v-if="groupedCompanies[role]?.length">
            <h4 class="text-xs font-medium text-muted-foreground mb-2">
              {{ COMPANY_ROLE_LABELS[role] || role }}
            </h4>
            <div class="grid grid-cols-[repeat(auto-fill,6rem)] gap-3 justify-between">
              <template
                v-for="link in groupedCompanies[role]"
                :key="link.id"
              >
                <CompanyCard
                  v-if="link.company"
                  :company="link.company"
                  align="left"
                  size="sm"
                  @click="openCompanyId = link.company.id"
                />
              </template>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- Edit Dialog -->
    <EntityLinksFormDialog
      v-if="editDialogOpen"
      v-model:open="editDialogOpen"
      view="game-companies"
      :entity-id="game.id"
    />

    <!-- Company Detail Dialog -->
    <CompanyDetailDialog
      v-if="openCompanyId"
      v-model:open="companyDialogOpen"
      :company-id="openCompanyId"
    />
  </template>
</template>
