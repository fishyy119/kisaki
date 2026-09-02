<!--
  ScraperProfilesFormDialog
  Dialog for managing all scraper profiles.
  - Local state array for profiles, saved as one batch
  - Unified creation dialog (recommended scene / single provider / blank)
  - Recipe update suggestions: profiles created from a recipe show a badge
    when the current recommendation differs from their configuration
-->
<script setup lang="ts">
import type { ScraperProfile } from '@shared/db'
import { CONTENT_ENTITY_TYPES } from '@shared/entity-types'

import { ref, watch, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { copyToClipboard } from '@renderer/core/clipboard'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { useAsyncData, useDbChanges } from '@renderer/composables'
import { scanners, scraperProfiles } from '@shared/db'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { StateView } from '@renderer/components/ui/state-view'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { ListItem, ListItemActions } from '@renderer/components/ui/list-item'
import { getEntityIcon } from '@renderer/utils/format'
import {
  computeRecipeFingerprint,
  fetchScraperProvidersByType,
  getRecipeById,
  getScraperProviderDisplay,
  materializeRecipe,
  resolveRecipeLanguageGroup,
  ScraperNewProfileDialog,
  type MaterializedRecipe,
  type ScraperProvidersByType
} from '@renderer/components/shared/scraper'
import ScraperProfilesItemFormDialog from './profile-item-form-dialog.vue'
import ScraperRecipeUpdateDialog from './recipe-update-dialog.vue'

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

// Profile form data type
interface ProfileFormData {
  profiles: ScraperProfile[]
  providersByType: ScraperProvidersByType
}

// Fetch data when dialog opens
const { data, isLoading, refetch } = useAsyncData(
  async (): Promise<ProfileFormData> => {
    const [profilesData, providersByType] = await Promise.all([
      db.select().from(scraperProfiles).orderBy(scraperProfiles.order),
      fetchScraperProvidersByType()
    ])
    return { profiles: profilesData, providersByType }
  },
  { enabled: () => open.value }
)

// Listen for external changes
useDbChanges(({ changes }) => {
  const membershipChanged = changes.some(
    (change) => change.table === 'scraper_profiles' && change.operation !== 'updated'
  )
  if (membershipChanged) refetch()
})

// Local state for editing
const profiles = ref<ScraperProfile[]>([])
const initialProfilesRef = ref<ScraperProfile[]>([])
const editingProfile = ref<ScraperProfile | null>(null)
const isAddMode = ref(false)
const isCreateDialogOpen = ref(false)
const deleteProfileId = ref<string | null>(null)
const isSaving = ref(false)
const editDialogOpen = ref(false)
const updateCandidate = ref<{ profile: ScraperProfile; recommendation: MaterializedRecipe } | null>(
  null
)
const updateDialogOpen = ref(false)

const providersByType = computed<ScraperProvidersByType>(() => {
  return (
    data.value?.providersByType ?? {
      game: [],
      anime: [],
      comic: [],
      novel: [],
      person: [],
      company: [],
      character: []
    }
  )
})

// Initialize local state when data loads
watch(
  () => data.value,
  (newData) => {
    if (newData) {
      profiles.value = [...newData.profiles]
      initialProfilesRef.value = [...newData.profiles]
    }
  },
  { immediate: true }
)

/**
 * Current recommendation per recipe-created profile, when it differs from the
 * profile's configuration and the user has not dismissed this exact
 * recommendation. Manual edits count as differences on purpose: the badge
 * then offers the way back to the curated ranking.
 */
const updateSuggestions = computed(() => {
  const suggestions = new Map<string, MaterializedRecipe>()

  for (const profile of profiles.value) {
    if (!profile.recipeId) continue
    const recipe = getRecipeById(profile.recipeId)
    if (!recipe) continue

    const group = resolveRecipeLanguageGroup(profile.defaultLocale ?? 'en')
    const recommendation = materializeRecipe(
      recipe,
      group,
      providersByType.value[profile.entityType]
    )
    if (!recommendation) continue

    const currentFingerprint = computeRecipeFingerprint({
      searchProviderId: profile.searchProviderId,
      slotConfigs: profile.slotConfigs
    })

    if (
      recommendation.fingerprint !== currentFingerprint &&
      recommendation.fingerprint !== profile.dismissedRecipeFingerprint
    ) {
      suggestions.set(profile.id, recommendation)
    }
  }

  return suggestions
})

// Profiles grouped into media-type sections, in registry order; empty types are dropped.
const profileGroups = computed(() =>
  CONTENT_ENTITY_TYPES.map((entityType) => ({
    entityType,
    label: m.value.library.entities[entityType],
    profiles: profiles.value.filter((profile) => profile.entityType === entityType)
  })).filter((group) => group.profiles.length > 0)
)

// Computed for delete dialog
const deleteDialogOpen = computed({
  get: () => deleteProfileId.value !== null,
  set: (value) => {
    if (!value) deleteProfileId.value = null
  }
})

const deleteProfileName = computed(() => {
  if (!deleteProfileId.value) return undefined
  const profile = profiles.value.find((p) => p.id === deleteProfileId.value)
  return profile?.name || undefined
})

// Deleting a profile unbinds scanners (FK set null), so the confirm dialog
// names how many scanners will fall back to direct import.
const { data: deleteAffectedScannerCount } = useAsyncData(
  async () => {
    if (!deleteProfileId.value) return 0
    const rows = await db
      .select({ id: scanners.id })
      .from(scanners)
      .where(eq(scanners.scraperProfileId, deleteProfileId.value))
    return rows.length
  },
  { watch: [deleteProfileId] }
)

const deleteConsequence = computed(() => {
  const affected = deleteAffectedScannerCount.value ?? 0
  return affected > 0
    ? m.value.scraper.profiles.deleteUsedByScanners({ count: affected })
    : undefined
})

function handleProfileCreated(profile: ScraperProfile, openEditor: boolean) {
  const positioned = { ...profile, order: profiles.value.length }
  if (openEditor) {
    editingProfile.value = positioned
    isAddMode.value = true
    editDialogOpen.value = true
    return
  }
  profiles.value = [...profiles.value, positioned]
}

function handleEdit(profile: ScraperProfile) {
  editingProfile.value = { ...profile }
  isAddMode.value = false
  editDialogOpen.value = true
}

function handleProfileSave(updatedProfile: ScraperProfile) {
  if (isAddMode.value) {
    profiles.value = [...profiles.value, updatedProfile]
  } else {
    profiles.value = profiles.value.map((p) => (p.id === updatedProfile.id ? updatedProfile : p))
  }
  editingProfile.value = null
  isAddMode.value = false
  editDialogOpen.value = false
}

// Clean up state when dialog closes (handles cancel scenario)
watch(
  () => editDialogOpen.value,
  (isOpen) => {
    if (!isOpen) {
      editingProfile.value = null
      isAddMode.value = false
    }
  }
)

watch(
  () => updateDialogOpen.value,
  (isOpen) => {
    if (!isOpen) {
      updateCandidate.value = null
    }
  }
)

function handleShowUpdate(profile: ScraperProfile) {
  const recommendation = updateSuggestions.value.get(profile.id)
  if (!recommendation) return
  updateCandidate.value = { profile, recommendation }
  updateDialogOpen.value = true
}

/**
 * Applies the recommendation onto the profile; the batch save persists it.
 * The content locale stays untouched — like the name, it is the user's
 * parameter, not curated knowledge.
 */
function handleApplyUpdate() {
  const candidate = updateCandidate.value
  if (!candidate) return

  profiles.value = profiles.value.map((profile) =>
    profile.id === candidate.profile.id
      ? {
          ...profile,
          searchProviderId: candidate.recommendation.searchProviderId,
          slotConfigs: candidate.recommendation.slotConfigs,
          dismissedRecipeFingerprint: null,
          updatedAt: new Date()
        }
      : profile
  )
}

/** Hides this exact recommendation; a changed one will surface again. */
function handleDismissUpdate() {
  const candidate = updateCandidate.value
  if (!candidate) return

  profiles.value = profiles.value.map((profile) =>
    profile.id === candidate.profile.id
      ? {
          ...profile,
          dismissedRecipeFingerprint: candidate.recommendation.fingerprint,
          updatedAt: new Date()
        }
      : profile
  )
}

function handleDeleteRequest(profileId: string) {
  deleteProfileId.value = profileId
}

function handleDeleteConfirm() {
  if (deleteProfileId.value) {
    profiles.value = profiles.value.filter((p) => p.id !== deleteProfileId.value)
  }
}

function handleMoveUp(index: number) {
  if (index <= 0) return
  const newProfiles = [...profiles.value]
  ;[newProfiles[index - 1], newProfiles[index]] = [newProfiles[index]!, newProfiles[index - 1]!]
  profiles.value = newProfiles
}

function handleMoveDown(index: number) {
  if (index >= profiles.value.length - 1) return
  const newProfiles = [...profiles.value]
  ;[newProfiles[index], newProfiles[index + 1]] = [newProfiles[index + 1]!, newProfiles[index]!]
  profiles.value = newProfiles
}

async function handleSave() {
  isSaving.value = true
  try {
    // Delete removed profiles
    const currentIds = new Set(profiles.value.map((p) => p.id))
    const deletedIds = initialProfilesRef.value
      .filter((p) => !currentIds.has(p.id))
      .map((p) => p.id)
    for (const id of deletedIds) {
      await db.delete(scraperProfiles).where(eq(scraperProfiles.id, id))
    }

    // Upsert all profiles with updated order
    for (let i = 0; i < profiles.value.length; i++) {
      const profile = profiles.value[i]!
      const isNew = !initialProfilesRef.value.some((p) => p.id === profile.id)

      if (isNew) {
        await db.insert(scraperProfiles).values({
          ...profile,
          order: i
        })
      } else {
        await db
          .update(scraperProfiles)
          .set({
            name: profile.name,
            description: profile.description,
            entityType: profile.entityType,
            recipeId: profile.recipeId,
            dismissedRecipeFingerprint: profile.dismissedRecipeFingerprint,
            searchProviderId: profile.searchProviderId,
            defaultLocale: profile.defaultLocale,
            slotConfigs: profile.slotConfigs,
            order: i
          })
          .where(eq(scraperProfiles.id, profile.id))
      }
    }

    notify.success(m.value.feedback.saved)
    open.value = false
  } catch {
    notify.error(m.value.feedback.saveFailed)
  } finally {
    isSaving.value = false
  }
}

function getGlobalIndex(profile: ScraperProfile): number {
  return profiles.value.findIndex((p) => p.id === profile.id)
}

// Pair each profile with its search provider display info
function withProviderDisplay(list: ScraperProfile[]) {
  return list.map((profile) => ({
    profile,
    providerDisplay: getScraperProviderDisplay(
      profile.searchProviderId,
      providersByType.value[profile.entityType],
      ['search']
    )
  }))
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ m.scraper.profiles.manageTitle }}</DialogTitle>
      </DialogHeader>

      <!-- Loading state -->
      <DialogBody v-if="isLoading || !data">
        <StateView
          state="loading"
          class="py-8"
        />
      </DialogBody>

      <!-- Content -->
      <template v-else>
        <DialogBody class="max-h-[60vh] overflow-auto">
          <StateView
            v-if="profiles.length === 0"
            state="empty"
            :description="m.scraper.profiles.emptyProfiles"
            class="py-8"
          />
          <div
            v-else
            class="space-y-4"
          >
            <!-- Group profiles by media type -->
            <div
              v-for="group in profileGroups"
              :key="group.entityType"
            >
              <h4 class="text-xs font-medium text-muted-foreground mb-1">
                {{ group.label }}
              </h4>
              <div class="space-y-1">
                <ListItem
                  v-for="{ profile, providerDisplay } in withProviderDisplay(group.profiles)"
                  :key="profile.id"
                  :icon="getEntityIcon(profile.entityType)"
                >
                  <div class="flex min-w-0 items-center gap-1.5">
                    <span class="text-sm font-medium truncate">
                      {{ profile.name || m.scraper.profiles.unnamed }}
                    </span>
                    <button
                      v-if="updateSuggestions.has(profile.id)"
                      type="button"
                      class="shrink-0"
                      @click="handleShowUpdate(profile)"
                    >
                      <Badge
                        variant="secondary"
                        class="px-1 py-0 cursor-pointer"
                      >
                        <Icon
                          icon="icon-[mdi--lightbulb-outline]"
                          class="size-3 mr-0.5"
                        />
                        {{ m.scraper.recipeUpdate.badge }}
                      </Badge>
                    </button>
                  </div>
                  <div class="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <!-- The raw provider id carries the extension namespace, so
                         same-named providers from different extensions stay apart. -->
                    <span class="truncate font-mono">{{ providerDisplay.id }}</span>
                    <Badge
                      v-if="providerDisplay.statusLabel"
                      variant="warning"
                      class="shrink-0 px-1 py-0"
                    >
                      {{ providerDisplay.statusLabel }}
                    </Badge>
                  </div>
                  <template #actions>
                    <ListItemActions
                      movable
                      :is-first="getGlobalIndex(profile) === 0"
                      :is-last="getGlobalIndex(profile) === profiles.length - 1"
                      @move-up="handleMoveUp(getGlobalIndex(profile))"
                      @move-down="handleMoveDown(getGlobalIndex(profile))"
                      @edit="handleEdit(profile)"
                      @delete="handleDeleteRequest(profile.id)"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        class="size-7"
                        :tooltip="m.scraper.profiles.copyId"
                        @click="copyToClipboard(profile.id)"
                      >
                        <Icon
                          icon="icon-[mdi--content-copy]"
                          class="size-4"
                        />
                      </Button>
                    </ListItemActions>
                  </template>
                </ListItem>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter class="flex justify-between">
          <Button
            type="button"
            variant="outline"
            @click="isCreateDialogOpen = true"
          >
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4 mr-1"
            />
            {{ m.scraper.profiles.addProfile }}
          </Button>
          <div class="flex gap-2">
            <Button
              type="button"
              variant="outline"
              @click="open = false"
            >
              {{ m.actions.cancel }}
            </Button>
            <Button
              type="button"
              :disabled="isSaving"
              @click="handleSave"
            >
              {{ isSaving ? m.states.saving : m.actions.save }}
            </Button>
          </div>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- Profile Edit Dialog -->
  <ScraperProfilesItemFormDialog
    v-if="editingProfile"
    v-model:open="editDialogOpen"
    :profile="editingProfile"
    :is-new="isAddMode"
    :providers-by-type="providersByType"
    :on-save="handleProfileSave"
  />

  <!-- Unified creation dialog -->
  <ScraperNewProfileDialog
    v-if="isCreateDialogOpen"
    v-model:open="isCreateDialogOpen"
    @create="handleProfileCreated"
  />

  <!-- Recipe update suggestion -->
  <ScraperRecipeUpdateDialog
    v-if="updateCandidate"
    v-model:open="updateDialogOpen"
    :profile="updateCandidate.profile"
    :recommendation="updateCandidate.recommendation"
    :providers="providersByType[updateCandidate.profile.entityType]"
    @apply="handleApplyUpdate"
    @dismiss="handleDismissUpdate"
  />

  <!-- Delete Confirmation Dialog -->
  <DeleteConfirmDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-label="m.scraper.profiles.profileEntityLabel"
    :entity-name="deleteProfileName"
    :consequence="deleteConsequence"
    mode="remove"
    @confirm="handleDeleteConfirm"
  />
</template>
