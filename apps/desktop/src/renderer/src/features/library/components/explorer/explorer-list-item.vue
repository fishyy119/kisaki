<script setup lang="ts">
/**
 * ExplorerListItem - Single entity item
 *
 * Renders a single entity in the explorer list with lazy-loaded images.
 * Each entity is wrapped with its corresponding context menu.
 */

import { computed, inject, type Component, type ComputedRef } from 'vue'
import { RouterLink, useRoute, type LocationQuery } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Icon } from '@renderer/components/ui/icon'
import { GameContextMenu, GameBatchContextMenu } from '@renderer/components/shared/game'
import { AnimeContextMenu, AnimeBatchContextMenu } from '@renderer/components/shared/anime'
import {
  CharacterContextMenu,
  CharacterBatchContextMenu
} from '@renderer/components/shared/character'
import { PersonContextMenu, PersonBatchContextMenu } from '@renderer/components/shared/person'
import { CompanyContextMenu, CompanyBatchContextMenu } from '@renderer/components/shared/company'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { getEntityIcon } from '@renderer/utils/format'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import { useLibraryExplorerStore } from '../../stores'
import { parseExplorerSelectionKey, toExplorerSelectionKey } from '../../utils/explorer-selection'
import type { EntityData } from '../../composables'
import type { ContentEntityType } from '@shared/common'
import type { Anime, Game, Character, Person, Company } from '@shared/db'

interface Props {
  entity: EntityData
  entityType: ContentEntityType
  from: string
}

const props = defineProps<Props>()

const store = useLibraryExplorerStore()
const { selectedKeys } = storeToRefs(store)

const visibleSelectionKeys = inject<ComputedRef<string[]>>(
  'explorerVisibleSelectionKeys',
  computed(() => [])
)

const rowKey = computed(() => toExplorerSelectionKey(props.from, props.entity.id))

const isSelected = computed(() => selectedKeys.value.includes(rowKey.value))
const useBatchMenu = computed(() => isSelected.value && selectedEntityIds.value.length > 1)

const selectedEntityIds = computed(() => {
  const ids = selectedKeys.value.map((key) => parseExplorerSelectionKey(key).id)
  return [...new Set(ids)]
})

const detailPath = computed(() => getEntityDetailPath(props.entityType, props.entity.id))

const linkQuery = computed(() => ({ from: props.from }))

const route = useRoute()

function isStrictQueryMatch(actual: LocationQuery, expected: Record<string, string>) {
  const actualKeys = Object.keys(actual)
  const expectedKeys = Object.keys(expected)

  if (actualKeys.length !== expectedKeys.length) {
    return false
  }

  actualKeys.sort()
  expectedKeys.sort()

  for (let index = 0; index < actualKeys.length; index++) {
    if (actualKeys[index] !== expectedKeys[index]) {
      return false
    }
  }

  return actualKeys.every((key) => {
    const actualValue = actual[key]
    const expectedValue = expected[key]

    if (Array.isArray(actualValue)) {
      return actualValue.length === 1 && actualValue[0] === expectedValue
    }

    return actualValue === expectedValue
  })
}

const isStrictActive = computed(() => {
  if (route.path !== detailPath.value) {
    return false
  }

  return isStrictQueryMatch(route.query, linkQuery.value)
})

const imageUrl = computed(() => {
  switch (props.entityType) {
    case 'game': {
      const game = props.entity as Game
      if (game.iconFile) {
        return getAttachmentUrl('games', game.id, game.iconFile, { width: 100, height: 100 })
      }
      if (game.coverFile) {
        return getAttachmentUrl('games', game.id, game.coverFile, { width: 100, height: 100 })
      }
      return null
    }
    case 'anime': {
      const anime = props.entity as Anime
      if (anime.coverFile) {
        return getAttachmentUrl('animes', anime.id, anime.coverFile, { width: 100, height: 100 })
      }
      return null
    }
    case 'character': {
      const character = props.entity as Character
      if (character.photoFile) {
        return getAttachmentUrl('characters', character.id, character.photoFile, {
          width: 100,
          height: 100
        })
      }
      return null
    }
    case 'person': {
      const person = props.entity as Person
      if (person.photoFile) {
        return getAttachmentUrl('persons', person.id, person.photoFile, {
          width: 100,
          height: 100
        })
      }
      return null
    }
    case 'company': {
      const company = props.entity as Company
      if (company.logoFile) {
        return getAttachmentUrl('companies', company.id, company.logoFile, {
          width: 100,
          height: 100
        })
      }
      return null
    }
    default:
      return null
  }
})

const entityIcon = computed(() => getEntityIcon(props.entityType))

/**
 * The row markup is identical for every entity type; only the context menu that
 * wraps it differs, so the wrapper is resolved here instead of in the template.
 */
const contextMenu = computed<{ component: Component; props: Record<string, unknown> }>(() => {
  const batchIds = selectedEntityIds.value
  const id = props.entity.id

  switch (props.entityType) {
    case 'game':
      return useBatchMenu.value
        ? { component: GameBatchContextMenu, props: { gameIds: batchIds } }
        : { component: GameContextMenu, props: { gameId: id } }
    case 'anime':
      return useBatchMenu.value
        ? { component: AnimeBatchContextMenu, props: { animeIds: batchIds } }
        : { component: AnimeContextMenu, props: { animeId: id } }
    case 'character':
      return useBatchMenu.value
        ? { component: CharacterBatchContextMenu, props: { characterIds: batchIds } }
        : { component: CharacterContextMenu, props: { characterId: id } }
    case 'person':
      return useBatchMenu.value
        ? { component: PersonBatchContextMenu, props: { personIds: batchIds } }
        : { component: PersonContextMenu, props: { personId: id } }
    case 'company':
      return useBatchMenu.value
        ? { component: CompanyBatchContextMenu, props: { companyIds: batchIds } }
        : { component: CompanyContextMenu, props: { companyId: id } }
    default:
      return props.entityType satisfies never
  }
})

function handleClick(e: MouseEvent) {
  if (e.shiftKey) {
    e.preventDefault()
    e.stopPropagation()
    store.selectRange(rowKey.value, visibleSelectionKeys.value, e.ctrlKey || e.metaKey)
    return
  }

  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    e.stopPropagation()
    store.toggleSelection(rowKey.value)
    return
  }

  store.setSelection([rowKey.value], rowKey.value)
}
</script>

<template>
  <component
    :is="contextMenu.component"
    v-bind="contextMenu.props"
    @deleted="store.clearSelection()"
  >
    <RouterLink
      :to="{ path: detailPath, query: linkQuery }"
      class="group relative flex items-center h-6 pl-4 pr-2 text-xs rounded-r-md text-muted-foreground hover:text-foreground hover:bg-accent/70 [&.is-strict-active]:text-accent-foreground [&.is-strict-active]:bg-accent [&.is-strict-active]:shadow-raised [&.is-selected]:text-foreground [&.is-selected]:bg-accent/50"
      :class="{ 'is-strict-active': isStrictActive, 'is-selected': isSelected && !isStrictActive }"
      @click="handleClick"
    >
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="props.entity.name"
        class="size-4 rounded-sm mr-1.5 border shadow-raised object-cover"
      />
      <Icon
        v-else
        :icon="entityIcon"
        class="size-4 text-muted-foreground/50 mr-1.5"
      />
      <span class="truncate">{{ props.entity.name }}</span>
    </RouterLink>
  </component>
</template>
