<!--
  ScraperNewProfileDialog
  Unified profile creation: pick a media type, then one of three paths —
  a recommended scene (recipe materialized against the live providers, with a
  confirm step for name, content language, and a slot preview), a single
  provider seeded across its capable slots, or a blank profile around one
  search provider. Recipe creations are complete on confirm; the other two
  paths hand a draft to the profile editor.
-->
<script setup lang="ts">
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/entity-types'
import type { ContentLocale } from '@shared/i18n'
import type { ScraperProfile } from '@shared/db'

import { computed, ref, watch } from 'vue'
import { newId } from '@shared/id'
import { Icon } from '@renderer/components/ui/icon'
import { useI18n } from '@renderer/composables'
import { createSlotConfigs, getScraperSlotsForEntityType } from '@shared/scraper'
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
import { Input } from '@renderer/components/ui/input'
import { StateView } from '@renderer/components/ui/state-view'
import { ContentLocaleSelect } from '@renderer/components/ui/locale-select'
import { Field, FieldContent, FieldLabel } from '@renderer/components/ui/field'
import { getEntityIcon } from '@renderer/utils/format'
import type { ScraperProviderInfo } from './provider-display'
import { useScraperProviders } from './use-scraper-providers'
import {
  getRecipesForEntityType,
  resolveRecipeLanguageGroup,
  type ScraperRecipe
} from './recipes/recipes'
import { assessRecipeAvailability, materializeRecipe } from './recipes/materialize'

interface Props {
  /** `recipes` hides the provider and blank paths (for quick-create hosts). */
  mode?: 'full' | 'recipes'
  /** Locks the dialog to one media type and skips the type step. */
  entityType?: ContentEntityType
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'full',
  entityType: undefined
})

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  /** A recipe creation is complete; a provider or blank draft wants the editor. */
  create: [profile: ScraperProfile, openEditor: boolean]
}>()

const { m, locale } = useI18n()

type CreationPath = 'recipes' | 'provider' | 'blank'

const selectedEntityType = ref<ContentEntityType | null>(null)
const path = ref<CreationPath>('recipes')
const confirmingRecipe = ref<ScraperRecipe | null>(null)
const profileName = ref('')
const contentLocale = ref<ContentLocale | null>(null)

// The provider lists are the availability ground truth for every path.
const { data: providersByType, isLoading } = useScraperProviders({ enabled: () => open.value })

const entityTypeOptions = computed<{ value: ContentEntityType; label: string }[]>(() =>
  CONTENT_ENTITY_TYPES.map((value) => ({ value, label: m.value.library.entities[value] }))
)

const currentProviders = computed<ScraperProviderInfo[]>(() => {
  if (!selectedEntityType.value || !providersByType.value) return []
  return providersByType.value[selectedEntityType.value] ?? []
})

const searchProviders = computed(() =>
  currentProviders.value.filter((provider) => provider.capabilities.includes('search'))
)

/** UI locales are a subset of content locales, so the mapping is identity. */
const defaultContentLocale = computed<ContentLocale>(() => locale.value as ContentLocale)

const languageGroup = computed(() =>
  resolveRecipeLanguageGroup(contentLocale.value ?? defaultContentLocale.value)
)

// Recipe cards for the selected media type, with live availability.
const recipeCards = computed(() => {
  if (!selectedEntityType.value) return []
  const group = resolveRecipeLanguageGroup(defaultContentLocale.value)
  return getRecipesForEntityType(selectedEntityType.value).map((recipe) => {
    const copy = recipe.copy(m.value)
    const availability = assessRecipeAvailability(recipe, group, currentProviders.value)
    return { recipe, copy, availability }
  })
})

// Confirm-step materialization; recomputed when the content language moves
// across the zh/intl boundary.
const confirmedMaterialization = computed(() => {
  if (!confirmingRecipe.value) return null
  return materializeRecipe(confirmingRecipe.value, languageGroup.value, currentProviders.value)
})

const slotPreview = computed(() => {
  const materialized = confirmedMaterialization.value
  if (!materialized || !selectedEntityType.value) return []

  return getScraperSlotsForEntityType(selectedEntityType.value)
    .map((slotName) => {
      const config = materialized.slotConfigs[slotName]
      const providerLabels = (config?.providers ?? [])
        .filter((entry) => entry.enabled)
        .map(
          (entry) =>
            currentProviders.value.find((provider) => provider.id === entry.providerId)?.name ??
            entry.providerId
        )
      return {
        slot: slotName,
        label: m.value.scraper.profiles.slots[slotName],
        providerLabels,
        strategy: config?.strategy ?? 'first'
      }
    })
    .filter((entry) => entry.providerLabels.length > 0)
})

watch(
  () => open.value,
  (isOpen) => {
    selectedEntityType.value = props.entityType ?? null
    if (!isOpen) {
      path.value = 'recipes'
      confirmingRecipe.value = null
      profileName.value = ''
      contentLocale.value = null
    }
  },
  { immediate: true }
)

function handleEntityTypeSelected(entityType: ContentEntityType) {
  selectedEntityType.value = entityType
  path.value = 'recipes'
}

function handleRecipeSelected(recipe: ScraperRecipe) {
  confirmingRecipe.value = recipe
  profileName.value = recipe.copy(m.value).name
  const group = resolveRecipeLanguageGroup(defaultContentLocale.value)
  contentLocale.value = recipe.variants[group].defaultLocale
}

function handleConfirmRecipe() {
  const materialized = confirmedMaterialization.value
  const recipe = confirmingRecipe.value
  if (!materialized || !recipe) return

  emit(
    'create',
    {
      id: newId(),
      name: profileName.value.trim() || recipe.copy(m.value).name,
      description: recipe.copy(m.value).description,
      entityType: materialized.entityType,
      recipeId: materialized.recipeId,
      dismissedRecipeFingerprint: null,
      searchProviderId: materialized.searchProviderId,
      defaultLocale: contentLocale.value ?? materialized.defaultLocale,
      slotConfigs: materialized.slotConfigs,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    false
  )
  open.value = false
}

function handleProviderSelected(provider: ScraperProviderInfo) {
  if (!selectedEntityType.value) return

  const seeded = path.value === 'provider'
  emit(
    'create',
    {
      id: newId(),
      name: '',
      description: null,
      entityType: selectedEntityType.value,
      recipeId: null,
      dismissedRecipeFingerprint: null,
      searchProviderId: provider.id,
      defaultLocale: null,
      slotConfigs: seeded
        ? createSlotConfigs(selectedEntityType.value, provider.id, [...provider.capabilities])
        : createSlotConfigs(selectedEntityType.value, provider.id, []),
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    true
  )
  open.value = false
}

function handleBack() {
  if (confirmingRecipe.value) {
    confirmingRecipe.value = null
    return
  }
  if (!props.entityType) {
    selectedEntityType.value = null
  }
}

const showBack = computed(
  () => confirmingRecipe.value !== null || (selectedEntityType.value !== null && !props.entityType)
)

const dialogTitle = computed(() => {
  if (confirmingRecipe.value) return m.value.scraper.newProfile.confirmTitle
  if (selectedEntityType.value) return m.value.scraper.newProfile.pathTitle
  return m.value.scraper.profiles.newTitleEntityType
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[65vh] overflow-auto">
        <StateView
          v-if="isLoading"
          state="loading"
          class="py-8"
        />

        <!-- Step 1: media type -->
        <template v-else-if="!selectedEntityType">
          <p class="text-sm text-muted-foreground mb-4">
            {{ m.scraper.profiles.newEntityTypeHint }}
          </p>
          <div class="space-y-1">
            <button
              v-for="option in entityTypeOptions"
              :key="option.value"
              type="button"
              class="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
              @click="() => handleEntityTypeSelected(option.value)"
            >
              <div class="size-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Icon
                  :icon="getEntityIcon(option.value)"
                  class="size-5 text-muted-foreground"
                />
              </div>
              <div class="min-w-0">
                <div class="text-sm font-medium">{{ option.label }}</div>
              </div>
            </button>
          </div>
        </template>

        <!-- Step 3: recipe confirm -->
        <template v-else-if="confirmingRecipe">
          <div class="space-y-4">
            <Field>
              <FieldLabel>{{ m.scraper.profiles.nameLabel }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="profileName"
                  :placeholder="m.scraper.profiles.namePlaceholder"
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>{{ m.scraper.profiles.defaultLanguageLabel }}</FieldLabel>
              <FieldContent>
                <ContentLocaleSelect v-model="contentLocale" />
              </FieldContent>
            </Field>

            <div v-if="confirmedMaterialization">
              <div class="text-xs font-medium text-muted-foreground mb-1">
                {{ m.scraper.newProfile.previewTitle }}
              </div>
              <div class="space-y-1 rounded-lg border p-2">
                <div
                  v-for="entry in slotPreview"
                  :key="entry.slot"
                  class="flex items-start gap-2 text-xs"
                >
                  <span class="w-24 shrink-0 text-muted-foreground">{{ entry.label }}</span>
                  <span class="min-w-0 flex-1">{{ entry.providerLabels.join(' → ') }}</span>
                  <Badge
                    variant="outline"
                    class="shrink-0 px-1 py-0"
                  >
                    {{
                      entry.strategy === 'enrich'
                        ? m.scraper.profiles.strategyEnrich
                        : m.scraper.profiles.strategyFirst
                    }}
                  </Badge>
                </div>
                <StateView
                  v-if="slotPreview.length === 0"
                  state="empty"
                  :description="m.scraper.newProfile.previewEmpty"
                  class="py-2"
                />
              </div>
            </div>
            <StateView
              v-else
              state="empty"
              :description="m.scraper.newProfile.recipeUnavailable"
              class="py-4"
            />
          </div>
        </template>

        <!-- Step 2: creation path -->
        <template v-else>
          <div
            v-if="props.mode === 'full'"
            class="mb-3 flex gap-1"
          >
            <Button
              v-for="option in ['recipes', 'provider', 'blank'] as CreationPath[]"
              :key="option"
              type="button"
              size="sm"
              :variant="path === option ? 'secondary' : 'ghost'"
              @click="path = option"
            >
              {{ m.scraper.newProfile.paths[option] }}
            </Button>
          </div>

          <!-- Recommended scenes -->
          <template v-if="path === 'recipes'">
            <p class="text-sm text-muted-foreground mb-3">
              {{ m.scraper.newProfile.recipesHint }}
            </p>
            <div class="space-y-1">
              <button
                v-for="card in recipeCards"
                :key="card.recipe.id"
                type="button"
                class="w-full rounded-lg border p-3 text-left transition-colors"
                :class="
                  card.availability.available
                    ? 'hover:bg-accent/50'
                    : 'opacity-60 cursor-not-allowed'
                "
                :disabled="!card.availability.available"
                @click="() => handleRecipeSelected(card.recipe)"
              >
                <div class="text-sm font-medium">{{ card.copy.name }}</div>
                <div class="text-xs text-muted-foreground">{{ card.copy.description }}</div>
                <div class="mt-1.5 flex flex-wrap gap-1">
                  <Badge
                    v-for="provider in card.availability.providers"
                    :key="provider.providerId"
                    :variant="provider.installed ? 'outline' : 'secondary'"
                    class="px-1 py-0 text-xs"
                    :class="provider.installed ? '' : 'opacity-60'"
                  >
                    {{ provider.label }}
                    <template v-if="!provider.installed">
                      · {{ m.scraper.newProfile.providerMissing }}
                    </template>
                  </Badge>
                </div>
                <div
                  v-if="!card.availability.available"
                  class="mt-1 text-xs text-muted-foreground"
                >
                  {{ m.scraper.newProfile.recipeUnavailable }}
                </div>
              </button>
              <StateView
                v-if="recipeCards.length === 0"
                state="empty"
                :description="m.scraper.newProfile.noRecipes"
                class="py-4"
              />
            </div>
          </template>

          <!-- Single provider / blank -->
          <template v-else>
            <p class="text-sm text-muted-foreground mb-3">
              {{
                path === 'provider'
                  ? m.scraper.profiles.newProviderHint
                  : m.scraper.newProfile.blankHint
              }}
            </p>
            <div class="space-y-1">
              <button
                v-for="provider in searchProviders"
                :key="provider.id"
                type="button"
                class="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                @click="() => handleProviderSelected(provider)"
              >
                <div class="size-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Icon
                    icon="icon-[mdi--database-outline]"
                    class="size-5 text-muted-foreground"
                  />
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-medium">{{ provider.name }}</div>
                  <div class="text-xs text-muted-foreground font-mono">{{ provider.id }}</div>
                </div>
              </button>
              <StateView
                v-if="searchProviders.length === 0"
                state="empty"
                :description="m.scraper.profiles.noProvidersAvailable"
                class="py-4"
              />
            </div>
          </template>
        </template>
      </DialogBody>
      <DialogFooter class="flex justify-between">
        <Button
          v-if="showBack"
          variant="outline"
          @click="handleBack"
        >
          <Icon
            icon="icon-[mdi--arrow-left]"
            class="size-4 mr-1"
          />
          {{ m.actions.back }}
        </Button>
        <div class="flex-1" />
        <Button
          variant="outline"
          @click="open = false"
        >
          {{ m.actions.cancel }}
        </Button>
        <Button
          v-if="confirmingRecipe"
          :disabled="!confirmedMaterialization"
          @click="handleConfirmRecipe"
        >
          {{ m.actions.create }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
