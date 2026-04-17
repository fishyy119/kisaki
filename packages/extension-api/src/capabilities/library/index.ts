import type { LibraryAttachmentCapability } from './attachments'
import type {
  LibraryCharacter,
  LibraryCharacterCreateInput,
  LibraryCharacterPatch,
  LibraryCharacterQuery,
  LibraryCollection,
  LibraryCollectionCreateInput,
  LibraryCollectionPatch,
  LibraryCollectionQuery,
  LibraryCompany,
  LibraryCompanyCreateInput,
  LibraryCompanyPatch,
  LibraryCompanyQuery,
  LibraryGame,
  LibraryGameCreateInput,
  LibraryGamePatch,
  LibraryGameQuery,
  LibraryPerson,
  LibraryPersonCreateInput,
  LibraryPersonPatch,
  LibraryPersonQuery,
  LibraryTag,
  LibraryTagCreateInput,
  LibraryTagPatch,
  LibraryTagQuery
} from './entities'
import type { LibraryRelationCapability } from './relations'

export interface LibraryEntityNamespace<TEntity, TCreate, TPatch, TQuery> {
  get(id: string): Promise<TEntity | null>
  list(query?: TQuery): Promise<readonly TEntity[]>
  create(input: TCreate): Promise<TEntity>
  update(id: string, patch: TPatch): Promise<TEntity>
  remove(id: string): Promise<void>
}

export interface LibraryCapability {
  games: LibraryEntityNamespace<
    LibraryGame,
    LibraryGameCreateInput,
    LibraryGamePatch,
    LibraryGameQuery
  >
  characters: LibraryEntityNamespace<
    LibraryCharacter,
    LibraryCharacterCreateInput,
    LibraryCharacterPatch,
    LibraryCharacterQuery
  >
  persons: LibraryEntityNamespace<
    LibraryPerson,
    LibraryPersonCreateInput,
    LibraryPersonPatch,
    LibraryPersonQuery
  >
  companies: LibraryEntityNamespace<
    LibraryCompany,
    LibraryCompanyCreateInput,
    LibraryCompanyPatch,
    LibraryCompanyQuery
  >
  collections: LibraryEntityNamespace<
    LibraryCollection,
    LibraryCollectionCreateInput,
    LibraryCollectionPatch,
    LibraryCollectionQuery
  >
  tags: LibraryEntityNamespace<LibraryTag, LibraryTagCreateInput, LibraryTagPatch, LibraryTagQuery>
  relations: LibraryRelationCapability
  attachments: LibraryAttachmentCapability
}

export type * from './attachments'
export type * from './entities'
export type * from './relations'
