<script setup lang="ts">
import { computed } from 'vue'
import type { AllEntityType } from '@shared/common'
import GameSelect from '../game/game-select.vue'
import PersonSelect from '../person/person-select.vue'
import CompanySelect from '../company/company-select.vue'
import CharacterSelect from '../character/character-select.vue'
import CollectionSelect from '../collection/collection-select.vue'
import TagSelect from '../tag/tag-select.vue'

interface Props {
  entityType: AllEntityType
  targetId: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const sourceId = defineModel<string>({ required: true })

const excludeIds = computed(() => [props.targetId])
const collectionSourceId = computed<string | null>({
  get: () => sourceId.value || null,
  set: (value) => {
    sourceId.value = value ?? ''
  }
})
</script>

<template>
  <GameSelect
    v-if="props.entityType === 'game'"
    v-model="sourceId"
    class="w-full"
    empty-text="选择重复游戏..."
    :exclude-ids="excludeIds"
    :disabled="props.disabled"
  />
  <PersonSelect
    v-else-if="props.entityType === 'person'"
    v-model="sourceId"
    class="w-full"
    empty-text="选择重复人物..."
    :exclude-ids="excludeIds"
    :disabled="props.disabled"
  />
  <CompanySelect
    v-else-if="props.entityType === 'company'"
    v-model="sourceId"
    class="w-full"
    empty-text="选择重复公司..."
    :exclude-ids="excludeIds"
    :disabled="props.disabled"
  />
  <CharacterSelect
    v-else-if="props.entityType === 'character'"
    v-model="sourceId"
    class="w-full"
    empty-text="选择重复角色..."
    :exclude-ids="excludeIds"
    :disabled="props.disabled"
  />
  <CollectionSelect
    v-else-if="props.entityType === 'collection'"
    v-model="collectionSourceId"
    class="w-full"
    empty-text="选择重复合集..."
    :exclude-ids="excludeIds"
    :allow-none="false"
    :allow-create="false"
    :disabled="props.disabled"
  />
  <TagSelect
    v-else
    v-model="sourceId"
    class="w-full"
    empty-text="选择重复标签..."
    :exclude-ids="excludeIds"
    :allow-create="false"
    :disabled="props.disabled"
  />
</template>
