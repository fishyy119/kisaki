/**
 * Entity tables the shared entity capability dialogs write.
 *
 * Values stay concrete table references (not the wide `SQLiteTable`) so
 * `db.update(...).set(...)` type-checks against the intersection of the
 * listed tables — exactly the columns every listed entity shares.
 */

import { animes, characters, companies, games, movies, persons, tvs } from '@shared/db'

export const ENTITY_TABLES = {
  game: games,
  anime: animes,
  tv: tvs,
  movie: movies,
  character: characters,
  person: persons,
  company: companies
} as const

/** Entity types that own the shared editable columns. */
export type TableEntityType = keyof typeof ENTITY_TABLES
