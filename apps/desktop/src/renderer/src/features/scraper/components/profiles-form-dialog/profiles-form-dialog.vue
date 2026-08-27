<!--
  ScraperProfilesFormDialog
  Dialog for managing all scraper profiles.
  Follows name-extraction-rules-dialog pattern:
  - Local state array for profiles
  - Edit dialog for each profile
  - Footer: Add + Preset (left), Cancel + Save (right)
-->
<script setup lang="ts">
import type { ScraperProfile } from '@shared/db'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/common'

import { ref, watch, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { Icon } from '@renderer/components/ui/icon'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { useAsyncData, useDbChanges } from '@renderer/composables'
import { ipcManager } from '@renderer/core/ipc'
import { scanners, scraperProfiles } from '@shared/db'
import { createSlotConfigs } from '@shared/scraper'
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
  ScraperPresetFormDialog,
  getScraperProviderDisplay,
  type ScraperProvidersByType
} from '@renderer/components/shared/scraper'
import ScraperProfilesItemFormDialog from './profile-item-form-dialog.vue'
import ScraperNewProfileDialog from './new-profile-dialog.vue'

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
    const [
      profilesData,
      gameProvidersResult,
      animeProvidersResult,
      comicProvidersResult,
      novelProvidersResult,
      personProvidersResult,
      companyProvidersResult,
      characterProvidersResult
    ] = await Promise.all([
      db.select().from(scraperProfiles).orderBy(scraperProfiles.order),
      ipcManager.invoke('scraper:list-game-providers'),
      ipcManager.invoke('scraper:list-anime-providers'),
      ipcManager.invoke('scraper:list-comic-providers'),
      ipcManager.invoke('scraper:list-novel-providers'),
      ipcManager.invoke('scraper:list-person-providers'),
      ipcManager.invoke('scraper:list-company-providers'),
      ipcManager.invoke('scraper:list-character-providers')
    ])
    return {
      profiles: profilesData,
      providersByType: {
        game: gameProvidersResult.success ? gameProvidersResult.data : [],
        anime: animeProvidersResult.success ? animeProvidersResult.data : [],
        comic: comicProvidersResult.success ? comicProvidersResult.data : [],
        novel: novelProvidersResult.success ? novelProvidersResult.data : [],
        person: personProvidersResult.success ? personProvidersResult.data : [],
        company: companyProvidersResult.success ? companyProvidersResult.data : [],
        character: characterProvidersResult.success ? characterProvidersResult.data : []
      }
    }
  },
  { enabled: () => open.value }
)

// Listen for external changes
useDbChanges(({ operation, table }) => {
  if (table === 'scraper_profiles' && operation !== 'updated') refetch()
})

// Local state for editing
const profiles = ref<ScraperProfile[]>([])
const initialProfilesRef = ref<ScraperProfile[]>([])
const editingProfile = ref<ScraperProfile | null>(null)
const isAddMode = ref(false)
const isPresetDialogOpen = ref(false)
const isProviderSelectOpen = ref(false)
const deleteProfileId = ref<string | null>(null)
const isSaving = ref(false)
const editDialogOpen = ref(false)

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

// Profiles grouped into media-type sections, in registry order; empty types are dropped.
const profileGroups = computed(() =>
  CONTENT_ENTITY_TYPES.map((mediaType) => ({
    mediaType,
    label: m.value.library.entities[mediaType],
    profiles: profiles.value.filter((profile) => profile.mediaType === mediaType)
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

function handleAddNew() {
  isProviderSelectOpen.value = true
}

function handleProviderSelected(mediaType: ContentEntityType, providerId: string) {
  // Find the provider to get its capabilities
  const provider = data.value?.providersByType[mediaType].find((p) => p.id === providerId)
  const capabilities = provider?.capabilities ?? []
  const newProfile: ScraperProfile = {
    id: nanoid(),
    name: '',
    description: null,
    mediaType,
    sourcePresetId: null,
    searchProviderId: providerId,
    defaultLocale: null,
    slotConfigs: createSlotConfigs(mediaType, providerId, capabilities),
    order: profiles.value.length,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  editingProfile.value = newProfile
  isAddMode.value = true
  editDialogOpen.value = true
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
  ;[newProfiles[index - 1], newProfiles[index]] = [newProfiles[index], newProfiles[index - 1]]
  profiles.value = newProfiles
}

function handleMoveDown(index: number) {
  if (index >= profiles.value.length - 1) return
  const newProfiles = [...profiles.value]
  ;[newProfiles[index], newProfiles[index + 1]] = [newProfiles[index + 1], newProfiles[index]]
  profiles.value = newProfiles
}

function handleAddPresets(presetProfiles: ScraperProfile[]) {
  profiles.value = [...profiles.value, ...presetProfiles]
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
      const profile = profiles.value[i]
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
            mediaType: profile.mediaType,
            searchProviderId: profile.searchProviderId,
            defaultLocale: profile.defaultLocale,
            slotConfigs: profile.slotConfigs,
            order: i
          })
          .where(eq(scraperProfiles.id, profile.id))
      }
    }

    notify.success(m.value.common.saved)
    open.value = false
  } catch {
    notify.error(m.value.common.saveFailed)
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
      providersByType.value[profile.mediaType],
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
              :key="group.mediaType"
            >
              <h4 class="text-xs font-medium text-muted-foreground mb-1">
                {{ group.label }}
              </h4>
              <div class="space-y-1">
                <ListItem
                  v-for="{ profile, providerDisplay } in withProviderDisplay(group.profiles)"
                  :key="profile.id"
                  :icon="getEntityIcon(profile.mediaType)"
                >
                  <div class="text-sm font-medium truncate">
                    {{ profile.name || m.scraper.profiles.unnamed }}
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
                    />
                  </template>
                </ListItem>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter class="flex justify-between">
          <div class="flex gap-2">
            <Button
              type="button"
              variant="outline"
              @click="handleAddNew"
            >
              <Icon
                icon="icon-[mdi--plus]"
                class="size-4 mr-1"
              />
              {{ m.scraper.profiles.addProfile }}
            </Button>
            <Button
              type="button"
              variant="outline"
              @click="isPresetDialogOpen = true"
            >
              <Icon
                icon="icon-[mdi--flash-outline]"
                class="size-4 mr-1"
              />
              {{ m.scraper.profiles.choosePreset }}
            </Button>
          </div>
          <div class="flex gap-2">
            <Button
              type="button"
              variant="outline"
              @click="open = false"
            >
              {{ m.common.cancel }}
            </Button>
            <Button
              type="button"
              :disabled="isSaving"
              @click="handleSave"
            >
              {{ isSaving ? m.common.saving : m.common.save }}
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

  <!-- Preset Dialog -->
  <ScraperPresetFormDialog
    v-if="isPresetDialogOpen"
    v-model:open="isPresetDialogOpen"
    :on-add="handleAddPresets"
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

  <!-- New Profile Dialog -->
  <ScraperNewProfileDialog
    v-if="isProviderSelectOpen"
    v-model:open="isProviderSelectOpen"
    :providers-by-type="providersByType"
    @select="handleProviderSelected"
  />
</template>
