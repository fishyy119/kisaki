<!--
  CharacterDetailDialog

  Dialog view for character details.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { characters } from '@shared/db'
import { useCharacterDialogProvider } from '@renderer/composables/use-character'
import { useEvent, useRenderState } from '@renderer/composables'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import { getEntityIcon } from '@renderer/utils/format'
import CharacterDetailContent from './detail-content.vue'
import { CharacterScoreFormDialog } from '../forms'
import { CharacterDropdownMenu } from '../menus'

// =============================================================================
// Props
// =============================================================================

interface Props {
  characterId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

// =============================================================================
// Provider
// =============================================================================

const { character, isLoading, error, spoilersRevealed } = useCharacterDialogProvider(
  () => props.characterId
)
const state = useRenderState(isLoading, error, character)

const spoilerConfirmOpen = ref(false)

useEvent('db.deleted', ({ table, id }) => {
  if (table === 'characters' && id === props.characterId) {
    open.value = false
  }
})

const isScoreOpen = ref(false)
const isPendingFavorite = ref(false)

// =============================================================================
// Computed
// =============================================================================

const displayScore = computed(() => {
  if (state.value !== 'success') return null
  const score = character.value?.score
  return score !== null && score !== undefined ? (score / 10).toFixed(1) : null
})

// =============================================================================
// Actions
// =============================================================================

async function handleToggleFavorite() {
  if (state.value !== 'success' || isPendingFavorite.value) return
  const current = character.value!
  isPendingFavorite.value = true
  try {
    await db
      .update(characters)
      .set({ isFavorite: !current.isFavorite })
      .where(eq(characters.id, current.id))
    notify.success(current.isFavorite ? '已取消喜欢' : '已添加至喜欢')
  } catch {
    notify.error('操作失败')
  } finally {
    isPendingFavorite.value = false
  }
}

function handleToggleSpoilers() {
  if (spoilersRevealed.value) {
    spoilersRevealed.value = false
    return
  }
  spoilerConfirmOpen.value = true
}

function handleRevealSpoilersConfirm() {
  spoilersRevealed.value = true
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-4xl max-h-[90vh] flex flex-col">
      <!-- Loading / Error / Not Found -->
      <template v-if="state !== 'success'">
        <DialogBody>
          <StateView
            :state="state"
            :error="error"
            :icon="getEntityIcon('character')"
            title="角色不存在"
            description="该角色可能已被删除"
            class="py-12"
          />
        </DialogBody>
      </template>

      <!-- Content state -->
      <template v-else-if="character">
        <DialogHeader>
          <DialogTitle>{{ character.name }}</DialogTitle>
        </DialogHeader>

        <DialogBody class="flex-1 min-h-0 overflow-auto p-4">
          <CharacterDetailContent />
        </DialogBody>

        <DialogFooter>
          <div class="flex items-center justify-end w-full">
            <!-- Right: Score, Favorite, More -->
            <div class="flex items-center gap-1.5">
              <Button
                variant="secondary"
                :size="displayScore ? 'sm' : 'icon-sm'"
                :class="displayScore ? 'text-warning' : ''"
                tooltip="评分"
                @click="isScoreOpen = true"
              >
                <Icon
                  icon="icon-[mdi--starburst-outline]"
                  class="size-4"
                />
                <span
                  v-if="displayScore"
                  class="text-xs"
                >
                  {{ displayScore }}
                </span>
              </Button>

              <Separator
                orientation="vertical"
                class="h-4"
              />

              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="character.isFavorite ? '取消喜欢' : '添加喜欢'"
                :disabled="isPendingFavorite"
                @click="handleToggleFavorite"
              >
                <Icon
                  icon="icon-[mdi--heart-outline]"
                  :class="character.isFavorite ? 'size-4 text-destructive' : 'size-4'"
                />
              </Button>

              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="spoilersRevealed ? '隐藏剧透' : '显示剧透'"
                @click="handleToggleSpoilers"
              >
                <Icon
                  :icon="
                    spoilersRevealed ? 'icon-[mdi--eye-outline]' : 'icon-[mdi--eye-off-outline]'
                  "
                  class="size-4"
                />
              </Button>

              <Separator
                orientation="vertical"
                class="h-4"
              />

              <!-- More menu -->
              <CharacterDropdownMenu :character-id="character.id" />
            </div>
          </div>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- Score Dialog -->
  <CharacterScoreFormDialog
    v-if="isScoreOpen && state === 'success' && character"
    v-model:open="isScoreOpen"
    :character-id="character.id"
  />

  <SpoilerConfirmDialog
    v-if="spoilerConfirmOpen"
    v-model:open="spoilerConfirmOpen"
    @confirm="handleRevealSpoilersConfirm"
  />
</template>
