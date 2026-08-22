/**
 * Entity detail dialog registry.
 *
 * Any surface that lists entities can open one, so the dialog is resolved from
 * the entity type instead of branching per type at every list.
 *
 * Entries are thunks on purpose: the dialogs a tag or collection opens are the
 * same dialogs listed here, so this module sits inside an import cycle with
 * them. Reading each binding when the dialog is rendered — rather than when
 * this module is evaluated — keeps every entry defined regardless of which
 * side of the cycle loads first.
 */

import type { Component } from 'vue'
import { AnimeDetailDialog } from '@renderer/components/shared/anime'
import { CharacterDetailDialog } from '@renderer/components/shared/character'
import { CollectionDetailDialog } from '@renderer/components/shared/collection'
import { CompanyDetailDialog } from '@renderer/components/shared/company'
import { GameDetailDialog } from '@renderer/components/shared/game'
import { PersonDetailDialog } from '@renderer/components/shared/person'
import { TagDetailDialog } from '@renderer/components/shared/tag'
import type { AllEntityType } from '@shared/common'

export const DETAIL_DIALOGS: Record<AllEntityType, () => Component> = {
  game: () => GameDetailDialog,
  anime: () => AnimeDetailDialog,
  character: () => CharacterDetailDialog,
  person: () => PersonDetailDialog,
  company: () => CompanyDetailDialog,
  collection: () => CollectionDetailDialog,
  tag: () => TagDetailDialog
}

/** The entity a surface asked to open, or `null` while no dialog is shown. */
export interface EntityDetailTarget {
  entityType: AllEntityType
  entityId: string
}
