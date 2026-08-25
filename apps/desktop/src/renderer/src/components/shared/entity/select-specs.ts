/**
 * Entity select registry.
 *
 * Generic pickers (merge source, relation filter, collection membership) resolve
 * an entity's select through this map, so a new entity type is one entry here
 * instead of another branch in every picker.
 *
 * Components are thunks on purpose: the domain folders listed here import back
 * from this module's barrel, so reading each binding when the picker renders —
 * rather than when this module is evaluated — keeps every entry defined
 * regardless of which side of the cycle loads first.
 */

import type { Component } from 'vue'
import { AnimeSelect } from '@renderer/components/shared/anime'
import { CharacterSelect } from '@renderer/components/shared/character'
import { CollectionSelect } from '@renderer/components/shared/collection'
import { ComicSelect } from '@renderer/components/shared/comic'
import { CompanySelect } from '@renderer/components/shared/company'
import { GameSelect } from '@renderer/components/shared/game'
import { NovelSelect } from '@renderer/components/shared/novel'
import { PersonSelect } from '@renderer/components/shared/person'
import { TagSelect } from '@renderer/components/shared/tag'
import type { AllEntityType } from '@shared/common'

export interface EntitySelectSpec {
  component: () => Component
  /**
   * Props that reduce the entity's own select to a plain picker. Only the
   * organizer selects carry extra affordances (creating a row, choosing none).
   */
  pickerProps?: Record<string, unknown>
}

export const ENTITY_SELECT_SPECS: Record<AllEntityType, EntitySelectSpec> = {
  game: { component: () => GameSelect },
  anime: { component: () => AnimeSelect },
  comic: { component: () => ComicSelect },
  novel: { component: () => NovelSelect },
  character: { component: () => CharacterSelect },
  person: { component: () => PersonSelect },
  company: { component: () => CompanySelect },
  collection: {
    component: () => CollectionSelect,
    pickerProps: { allowNone: false, allowCreate: false }
  },
  tag: { component: () => TagSelect, pickerProps: { allowCreate: false } }
}
