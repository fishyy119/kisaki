/**
 * Link-view specs for the shared role-grouped link dialogs.
 *
 * Every cross-entity link table (media <-> satellite, character <-> person)
 * stores the same shape: role + note + spoiler + one order column per side.
 * A view is one editing direction over one table; its spec owns the concrete
 * table columns, the role vocabulary and the target-entity presentation, so
 * the dialogs stay entirely spec-driven.
 *
 * Replacing a view rewrites the anchor's rows with fresh anchor-side order
 * values while carrying each surviving row's opposite-side order through.
 */

import { asc, eq } from 'drizzle-orm'
import { db, queryEntityRow } from '@renderer/core/db'
import {
  ANIME_CHARACTER_ROLE_VALUES,
  ANIME_COMPANY_ROLE_VALUES,
  ANIME_PERSON_ROLE_VALUES,
  CHARACTER_PERSON_ROLE_VALUES,
  GAME_CHARACTER_ROLE_VALUES,
  GAME_COMPANY_ROLE_VALUES,
  GAME_PERSON_ROLE_VALUES,
  animeCharacterLinks,
  animeCompanyLinks,
  animePersonLinks,
  characterPersonLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks,
  type AnimeCharacterRole,
  type AnimeCompanyRole,
  type AnimePersonRole,
  type CharacterPersonRole,
  type GameCharacterRole,
  type GameCompanyRole,
  type GamePersonRole
} from '@shared/db'
import type { ContentEntityType } from '@shared/common'
import type { Messages } from '@shared/i18n'
import { getEntityImageFile } from '@renderer/utils/entity-image'

export interface LinkRow {
  id: string
  targetId: string
  targetName: string
  targetImage: string | null
  role: string
  note: string | null
  isSpoiler: boolean
  /** Order value on the opposite side, carried through replaces untouched. */
  counterOrder: number
}

export interface LinkReplaceRow {
  id: string
  targetId: string
  role: string
  note: string | null
  isSpoiler: boolean
  order: number
  counterOrder: number
}

export interface LinkViewSpec {
  targetType: ContentEntityType
  /** Role grouping/display order; also the source of valid role values. */
  roleOrder: readonly string[]
  roleLabels: (m: Messages) => Record<string, string>
  /** Field label for the role select; owned by the role vocabulary. */
  roleFieldLabel: (m: Messages) => string
  title: (m: Messages) => string
  list: (anchorId: string) => Promise<LinkRow[]>
  replace: (anchorId: string, rows: LinkReplaceRow[]) => Promise<void>
}

/**
 * Media-person rows for one entry, optionally narrowed to a role scope.
 *
 * Anchor-side order is assigned per role group, so a scoped view sees the same
 * sequence the full view would show for those roles.
 */
export const LINK_VIEW_SPECS = {
  'game-characters': {
    targetType: 'character',
    roleOrder: GAME_CHARACTER_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.gameCharacter,
    roleFieldLabel: (m) => m.library.forms.characterRoleLabel,
    title: (m) => m.library.forms.editGameCharacters,
    list: async (anchorId) => {
      const rows = await db.query.gameCharacterLinks.findMany({
        where: eq(gameCharacterLinks.gameId, anchorId),
        with: { character: true },
        orderBy: asc(gameCharacterLinks.orderInGame)
      })
      return rows
        .filter((row) => row.character)
        .map((row) => ({
          id: row.id,
          targetId: row.characterId,
          targetName: row.character!.name,
          targetImage: row.character!.photoFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInCharacter
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(gameCharacterLinks).where(eq(gameCharacterLinks.gameId, anchorId))
      if (rows.length > 0) {
        await db.insert(gameCharacterLinks).values(
          rows.map((row) => ({
            id: row.id,
            gameId: anchorId,
            characterId: row.targetId,
            role: row.role as GameCharacterRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInGame: row.order,
            orderInCharacter: row.counterOrder
          }))
        )
      }
    }
  },
  'game-persons': {
    targetType: 'person',
    roleOrder: GAME_PERSON_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.gamePerson,
    roleFieldLabel: (m) => m.library.forms.personRoleLabel,
    title: (m) => m.library.forms.editGamePersons,
    list: async (anchorId) => {
      const rows = await db.query.gamePersonLinks.findMany({
        where: eq(gamePersonLinks.gameId, anchorId),
        with: { person: true },
        orderBy: asc(gamePersonLinks.orderInGame)
      })
      return rows
        .filter((row) => row.person)
        .map((row) => ({
          id: row.id,
          targetId: row.personId,
          targetName: row.person!.name,
          targetImage: row.person!.photoFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInPerson
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(gamePersonLinks).where(eq(gamePersonLinks.gameId, anchorId))
      if (rows.length > 0) {
        await db.insert(gamePersonLinks).values(
          rows.map((row) => ({
            id: row.id,
            gameId: anchorId,
            personId: row.targetId,
            role: row.role as GamePersonRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInGame: row.order,
            orderInPerson: row.counterOrder
          }))
        )
      }
    }
  },
  'game-companies': {
    targetType: 'company',
    roleOrder: GAME_COMPANY_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.gameCompany,
    roleFieldLabel: (m) => m.library.forms.companyRoleLabel,
    title: (m) => m.library.forms.editGameCompanies,
    list: async (anchorId) => {
      const rows = await db.query.gameCompanyLinks.findMany({
        where: eq(gameCompanyLinks.gameId, anchorId),
        with: { company: true },
        orderBy: asc(gameCompanyLinks.orderInGame)
      })
      return rows
        .filter((row) => row.company)
        .map((row) => ({
          id: row.id,
          targetId: row.companyId,
          targetName: row.company!.name,
          targetImage: row.company!.logoFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInCompany
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(gameCompanyLinks).where(eq(gameCompanyLinks.gameId, anchorId))
      if (rows.length > 0) {
        await db.insert(gameCompanyLinks).values(
          rows.map((row) => ({
            id: row.id,
            gameId: anchorId,
            companyId: row.targetId,
            role: row.role as GameCompanyRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInGame: row.order,
            orderInCompany: row.counterOrder
          }))
        )
      }
    }
  },
  'anime-characters': {
    targetType: 'character',
    roleOrder: ANIME_CHARACTER_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.animeCharacter,
    roleFieldLabel: (m) => m.library.forms.characterRoleLabel,
    title: (m) => m.library.forms.editAnimeCharacters,
    list: async (anchorId) => {
      const rows = await db.query.animeCharacterLinks.findMany({
        where: eq(animeCharacterLinks.animeId, anchorId),
        with: { character: true },
        orderBy: asc(animeCharacterLinks.orderInAnime)
      })
      return rows
        .filter((row) => row.character)
        .map((row) => ({
          id: row.id,
          targetId: row.characterId,
          targetName: row.character!.name,
          targetImage: row.character!.photoFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInCharacter
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(animeCharacterLinks).where(eq(animeCharacterLinks.animeId, anchorId))
      if (rows.length > 0) {
        await db.insert(animeCharacterLinks).values(
          rows.map((row) => ({
            id: row.id,
            animeId: anchorId,
            characterId: row.targetId,
            role: row.role as AnimeCharacterRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInAnime: row.order,
            orderInCharacter: row.counterOrder
          }))
        )
      }
    }
  },
  'anime-persons': {
    targetType: 'person',
    roleOrder: ANIME_PERSON_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.animePerson,
    roleFieldLabel: (m) => m.library.forms.personRoleLabel,
    title: (m) => m.library.forms.editAnimePersons,
    list: async (anchorId) => {
      const rows = await db.query.animePersonLinks.findMany({
        where: eq(animePersonLinks.animeId, anchorId),
        with: { person: true },
        orderBy: asc(animePersonLinks.orderInAnime)
      })
      return rows
        .filter((row) => row.person)
        .map((row) => ({
          id: row.id,
          targetId: row.personId,
          targetName: row.person!.name,
          targetImage: row.person!.photoFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInPerson
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(animePersonLinks).where(eq(animePersonLinks.animeId, anchorId))
      if (rows.length > 0) {
        await db.insert(animePersonLinks).values(
          rows.map((row) => ({
            id: row.id,
            animeId: anchorId,
            personId: row.targetId,
            role: row.role as AnimePersonRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInAnime: row.order,
            orderInPerson: row.counterOrder
          }))
        )
      }
    }
  },
  'anime-companies': {
    targetType: 'company',
    roleOrder: ANIME_COMPANY_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.animeCompany,
    roleFieldLabel: (m) => m.library.forms.companyRoleLabel,
    title: (m) => m.library.forms.editAnimeCompanies,
    list: async (anchorId) => {
      const rows = await db.query.animeCompanyLinks.findMany({
        where: eq(animeCompanyLinks.animeId, anchorId),
        with: { company: true },
        orderBy: asc(animeCompanyLinks.orderInAnime)
      })
      return rows
        .filter((row) => row.company)
        .map((row) => ({
          id: row.id,
          targetId: row.companyId,
          targetName: row.company!.name,
          targetImage: row.company!.logoFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInCompany
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(animeCompanyLinks).where(eq(animeCompanyLinks.animeId, anchorId))
      if (rows.length > 0) {
        await db.insert(animeCompanyLinks).values(
          rows.map((row) => ({
            id: row.id,
            animeId: anchorId,
            companyId: row.targetId,
            role: row.role as AnimeCompanyRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInAnime: row.order,
            orderInCompany: row.counterOrder
          }))
        )
      }
    }
  },
  'character-games': {
    targetType: 'game',
    roleOrder: GAME_CHARACTER_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.gameCharacter,
    roleFieldLabel: (m) => m.library.forms.characterRoleLabel,
    title: (m) => m.library.forms.editCharacterGames,
    list: async (anchorId) => {
      const rows = await db.query.gameCharacterLinks.findMany({
        where: eq(gameCharacterLinks.characterId, anchorId),
        with: { game: true },
        orderBy: asc(gameCharacterLinks.orderInCharacter)
      })
      return rows
        .filter((row) => row.game)
        .map((row) => ({
          id: row.id,
          targetId: row.gameId,
          targetName: row.game!.name,
          targetImage: row.game!.coverFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInGame
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(gameCharacterLinks).where(eq(gameCharacterLinks.characterId, anchorId))
      if (rows.length > 0) {
        await db.insert(gameCharacterLinks).values(
          rows.map((row) => ({
            id: row.id,
            characterId: anchorId,
            gameId: row.targetId,
            role: row.role as GameCharacterRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInCharacter: row.order,
            orderInGame: row.counterOrder
          }))
        )
      }
    }
  },
  'character-animes': {
    targetType: 'anime',
    roleOrder: ANIME_CHARACTER_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.animeCharacter,
    roleFieldLabel: (m) => m.library.forms.characterRoleLabel,
    title: (m) => m.library.forms.editCharacterAnimes,
    list: async (anchorId) => {
      const rows = await db.query.animeCharacterLinks.findMany({
        where: eq(animeCharacterLinks.characterId, anchorId),
        with: { anime: true },
        orderBy: asc(animeCharacterLinks.orderInCharacter)
      })
      return rows
        .filter((row) => row.anime)
        .map((row) => ({
          id: row.id,
          targetId: row.animeId,
          targetName: row.anime!.name,
          targetImage: row.anime!.coverFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInAnime
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(animeCharacterLinks).where(eq(animeCharacterLinks.characterId, anchorId))
      if (rows.length > 0) {
        await db.insert(animeCharacterLinks).values(
          rows.map((row) => ({
            id: row.id,
            characterId: anchorId,
            animeId: row.targetId,
            role: row.role as AnimeCharacterRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInCharacter: row.order,
            orderInAnime: row.counterOrder
          }))
        )
      }
    }
  },
  'character-persons': {
    targetType: 'person',
    roleOrder: CHARACTER_PERSON_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.characterPerson,
    roleFieldLabel: (m) => m.library.fields.type,
    title: (m) => m.library.forms.editCharacterPersons,
    list: async (anchorId) => {
      const rows = await db.query.characterPersonLinks.findMany({
        where: eq(characterPersonLinks.characterId, anchorId),
        with: { person: true },
        orderBy: asc(characterPersonLinks.orderInCharacter)
      })
      return rows
        .filter((row) => row.person)
        .map((row) => ({
          id: row.id,
          targetId: row.personId,
          targetName: row.person!.name,
          targetImage: row.person!.photoFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInPerson
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(characterPersonLinks).where(eq(characterPersonLinks.characterId, anchorId))
      if (rows.length > 0) {
        await db.insert(characterPersonLinks).values(
          rows.map((row) => ({
            id: row.id,
            characterId: anchorId,
            personId: row.targetId,
            role: row.role as CharacterPersonRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInCharacter: row.order,
            orderInPerson: row.counterOrder
          }))
        )
      }
    }
  },
  'person-games': {
    targetType: 'game',
    roleOrder: GAME_PERSON_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.gamePerson,
    roleFieldLabel: (m) => m.library.forms.personRoleLabel,
    title: (m) => m.library.forms.editPersonGames,
    list: async (anchorId) => {
      const rows = await db.query.gamePersonLinks.findMany({
        where: eq(gamePersonLinks.personId, anchorId),
        with: { game: true },
        orderBy: asc(gamePersonLinks.orderInPerson)
      })
      return rows
        .filter((row) => row.game)
        .map((row) => ({
          id: row.id,
          targetId: row.gameId,
          targetName: row.game!.name,
          targetImage: row.game!.coverFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInGame
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(gamePersonLinks).where(eq(gamePersonLinks.personId, anchorId))
      if (rows.length > 0) {
        await db.insert(gamePersonLinks).values(
          rows.map((row) => ({
            id: row.id,
            personId: anchorId,
            gameId: row.targetId,
            role: row.role as GamePersonRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInPerson: row.order,
            orderInGame: row.counterOrder
          }))
        )
      }
    }
  },
  'person-animes': {
    targetType: 'anime',
    roleOrder: ANIME_PERSON_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.animePerson,
    roleFieldLabel: (m) => m.library.forms.personRoleLabel,
    title: (m) => m.library.forms.editPersonAnimes,
    list: async (anchorId) => {
      const rows = await db.query.animePersonLinks.findMany({
        where: eq(animePersonLinks.personId, anchorId),
        with: { anime: true },
        orderBy: asc(animePersonLinks.orderInPerson)
      })
      return rows
        .filter((row) => row.anime)
        .map((row) => ({
          id: row.id,
          targetId: row.animeId,
          targetName: row.anime!.name,
          targetImage: row.anime!.coverFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInAnime
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(animePersonLinks).where(eq(animePersonLinks.personId, anchorId))
      if (rows.length > 0) {
        await db.insert(animePersonLinks).values(
          rows.map((row) => ({
            id: row.id,
            personId: anchorId,
            animeId: row.targetId,
            role: row.role as AnimePersonRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInPerson: row.order,
            orderInAnime: row.counterOrder
          }))
        )
      }
    }
  },
  'person-characters': {
    targetType: 'character',
    roleOrder: CHARACTER_PERSON_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.characterPerson,
    roleFieldLabel: (m) => m.library.fields.type,
    title: (m) => m.library.forms.editPersonCharacters,
    list: async (anchorId) => {
      const rows = await db.query.characterPersonLinks.findMany({
        where: eq(characterPersonLinks.personId, anchorId),
        with: { character: true },
        orderBy: asc(characterPersonLinks.orderInPerson)
      })
      return rows
        .filter((row) => row.character)
        .map((row) => ({
          id: row.id,
          targetId: row.characterId,
          targetName: row.character!.name,
          targetImage: row.character!.photoFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInCharacter
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(characterPersonLinks).where(eq(characterPersonLinks.personId, anchorId))
      if (rows.length > 0) {
        await db.insert(characterPersonLinks).values(
          rows.map((row) => ({
            id: row.id,
            personId: anchorId,
            characterId: row.targetId,
            role: row.role as CharacterPersonRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInPerson: row.order,
            orderInCharacter: row.counterOrder
          }))
        )
      }
    }
  },
  'company-games': {
    targetType: 'game',
    roleOrder: GAME_COMPANY_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.gameCompany,
    roleFieldLabel: (m) => m.library.forms.companyRoleLabel,
    title: (m) => m.library.forms.editCompanyGames,
    list: async (anchorId) => {
      const rows = await db.query.gameCompanyLinks.findMany({
        where: eq(gameCompanyLinks.companyId, anchorId),
        with: { game: true },
        orderBy: asc(gameCompanyLinks.orderInCompany)
      })
      return rows
        .filter((row) => row.game)
        .map((row) => ({
          id: row.id,
          targetId: row.gameId,
          targetName: row.game!.name,
          targetImage: row.game!.coverFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInGame
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(gameCompanyLinks).where(eq(gameCompanyLinks.companyId, anchorId))
      if (rows.length > 0) {
        await db.insert(gameCompanyLinks).values(
          rows.map((row) => ({
            id: row.id,
            companyId: anchorId,
            gameId: row.targetId,
            role: row.role as GameCompanyRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInCompany: row.order,
            orderInGame: row.counterOrder
          }))
        )
      }
    }
  },
  'company-animes': {
    targetType: 'anime',
    roleOrder: ANIME_COMPANY_ROLE_VALUES,
    roleLabels: (m) => m.library.roles.animeCompany,
    roleFieldLabel: (m) => m.library.forms.companyRoleLabel,
    title: (m) => m.library.forms.editCompanyAnimes,
    list: async (anchorId) => {
      const rows = await db.query.animeCompanyLinks.findMany({
        where: eq(animeCompanyLinks.companyId, anchorId),
        with: { anime: true },
        orderBy: asc(animeCompanyLinks.orderInCompany)
      })
      return rows
        .filter((row) => row.anime)
        .map((row) => ({
          id: row.id,
          targetId: row.animeId,
          targetName: row.anime!.name,
          targetImage: row.anime!.coverFile,
          role: row.role,
          note: row.note,
          isSpoiler: row.isSpoiler,
          counterOrder: row.orderInAnime
        }))
    },
    replace: async (anchorId, rows) => {
      await db.delete(animeCompanyLinks).where(eq(animeCompanyLinks.companyId, anchorId))
      if (rows.length > 0) {
        await db.insert(animeCompanyLinks).values(
          rows.map((row) => ({
            id: row.id,
            companyId: anchorId,
            animeId: row.targetId,
            role: row.role as AnimeCompanyRole,
            note: row.note,
            isSpoiler: row.isSpoiler,
            orderInCompany: row.order,
            orderInAnime: row.counterOrder
          }))
        )
      }
    }
  }
} satisfies Record<string, LinkViewSpec>

export type LinkViewKey = keyof typeof LINK_VIEW_SPECS

/** Fetches a selected target's display fields for the item dialog. */
export async function fetchLinkTarget(
  targetType: ContentEntityType,
  id: string
): Promise<{ name: string; image: string | null } | undefined> {
  const row = await queryEntityRow(targetType, id)
  if (!row) return undefined
  return { name: row.name, image: getEntityImageFile(targetType, row, 'cover') }
}
