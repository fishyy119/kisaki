import {
  assertValidLibraryAnimeCreateInput,
  assertValidLibraryAnimeEpisodeCreateInput,
  assertValidLibraryAnimeEpisodeQuery,
  assertValidLibraryAnimeEpisodeWatchStatePatch,
  assertValidLibraryAnimePatch,
  assertValidLibraryAnimeQuery,
  assertValidLibraryAttachmentOwnerReference,
  assertValidLibraryAttachmentRemoveInput,
  assertValidLibraryAttachmentWriteInput,
  assertValidLibraryCharacterCreateInput,
  assertValidLibraryCharacterPatch,
  assertValidLibraryCharacterQuery,
  assertValidLibraryCollectionCreateInput,
  assertValidLibraryCollectionPatch,
  assertValidLibraryCollectionQuery,
  assertValidLibraryComicChapterCreateInput,
  assertValidLibraryComicChapterQuery,
  assertValidLibraryComicChapterReadStatePatch,
  assertValidLibraryComicCreateInput,
  assertValidLibraryComicPatch,
  assertValidLibraryComicQuery,
  assertValidLibraryCompanyCreateInput,
  assertValidLibraryCompanyPatch,
  assertValidLibraryCompanyQuery,
  assertValidLibraryEntityId,
  assertValidLibraryGameCreateInput,
  assertValidLibraryGamePatch,
  assertValidLibraryGameQuery,
  assertValidLibraryPersonCreateInput,
  assertValidLibraryPersonPatch,
  assertValidLibraryPersonQuery,
  assertValidLibraryNovelCreateInput,
  assertValidLibraryNovelPatch,
  assertValidLibraryNovelQuery,
  assertValidLibraryNovelVolumeCreateInput,
  assertValidLibraryNovelVolumeQuery,
  assertValidLibraryNovelVolumeReadStatePatch,
  assertValidLibraryLinkCreateInput,
  assertValidLibraryLinkQuery,
  assertValidLibraryLinkSelector,
  assertValidLibraryLinkUpdateInput,
  assertValidLibraryMediaRelationCreateInput,
  assertValidLibraryMediaRelationQuery,
  assertValidLibraryMediaRelationSelector,
  assertValidLibraryMediaRelationUpdateInput,
  assertValidLibraryTagCreateInput,
  assertValidLibraryTagPatch,
  assertValidLibraryTagQuery,
  createUnavailableError,
  type ExtensionRuntimeMetadata,
  type HostToMainRpcMethod,
  type LibraryAnime,
  type LibraryAnimeCreateInput,
  type LibraryAnimePatch,
  type LibraryAnimeQuery,
  type LibraryCharacter,
  type LibraryCharacterCreateInput,
  type LibraryCharacterPatch,
  type LibraryCharacterQuery,
  type LibraryCollection,
  type LibraryCollectionCreateInput,
  type LibraryCollectionPatch,
  type LibraryCollectionQuery,
  type LibraryComic,
  type LibraryComicCreateInput,
  type LibraryComicPatch,
  type LibraryComicQuery,
  type LibraryCompany,
  type LibraryCompanyCreateInput,
  type LibraryCompanyPatch,
  type LibraryCompanyQuery,
  type LibraryGame,
  type LibraryGameCreateInput,
  type LibraryGamePatch,
  type LibraryGameQuery,
  type LibraryGraphInput,
  type LibraryNovel,
  type LibraryNovelCreateInput,
  type LibraryNovelPatch,
  type LibraryNovelQuery,
  type LibraryPerson,
  type LibraryPersonCreateInput,
  type LibraryPersonPatch,
  type LibraryPersonQuery,
  type LibraryTag,
  type LibraryTagCreateInput,
  type LibraryTagPatch,
  type LibraryTagQuery
} from '@kisaki3/extension-api'
import type { DbService } from '@main/services/db'
import type { ExtensionHostRpcClient } from '../../runtime'
import { ExtensionLibraryAttachmentStore } from './attachments'
import {
  ExtensionLibraryComicChapterStore,
  ExtensionLibraryEntityStore,
  ExtensionLibraryEpisodeStore,
  ExtensionLibraryNovelVolumeStore
} from './entities'
import { ExtensionLibraryGraphManager } from './graph'
import { ExtensionLibraryLinkStore } from './links'
import { ExtensionLibraryMediaRelationStore } from './relations'

type LibraryEntityNamespaceName =
  | 'games'
  | 'animes'
  | 'comics'
  | 'novels'
  | 'characters'
  | 'persons'
  | 'companies'
  | 'collections'
  | 'tags'
type LibraryEntityRpcMethod<
  TNamespace extends LibraryEntityNamespaceName,
  TAction extends 'get' | 'list' | 'create' | 'update' | 'remove'
> = Extract<HostToMainRpcMethod, `capabilities.library.${TNamespace}.${TAction}`>

interface LibraryEntityRpcDescriptor<
  TNamespace extends LibraryEntityNamespaceName,
  TEntity,
  TCreate,
  TPatch,
  TQuery
> {
  namespace: TNamespace
  methods: {
    get: LibraryEntityRpcMethod<TNamespace, 'get'>
    list: LibraryEntityRpcMethod<TNamespace, 'list'>
    create: LibraryEntityRpcMethod<TNamespace, 'create'>
    update: LibraryEntityRpcMethod<TNamespace, 'update'>
    remove: LibraryEntityRpcMethod<TNamespace, 'remove'>
  }
  get(id: string): TEntity | null
  list(query?: TQuery): readonly TEntity[]
  create(input: TCreate): TEntity
  update(id: string, patch: TPatch): TEntity
  remove(id: string): void
  assertQuery(value: unknown): asserts value is TQuery | undefined
  assertCreate(value: unknown): asserts value is TCreate
  assertPatch(value: unknown): asserts value is TPatch
}

export interface ExtensionLibraryCapabilityProviderOptions {
  db: DbService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionLibraryCapabilityProvider {
  readonly entities: ExtensionLibraryEntityStore
  readonly episodes: ExtensionLibraryEpisodeStore
  readonly chapters: ExtensionLibraryComicChapterStore
  readonly volumes: ExtensionLibraryNovelVolumeStore
  readonly links: ExtensionLibraryLinkStore
  readonly relations: ExtensionLibraryMediaRelationStore
  readonly attachments: ExtensionLibraryAttachmentStore
  readonly graph: ExtensionLibraryGraphManager

  constructor(private readonly options: ExtensionLibraryCapabilityProviderOptions) {
    this.entities = new ExtensionLibraryEntityStore({ db: options.db })
    this.episodes = new ExtensionLibraryEpisodeStore({ db: options.db })
    this.chapters = new ExtensionLibraryComicChapterStore({ db: options.db })
    this.volumes = new ExtensionLibraryNovelVolumeStore({ db: options.db })
    this.links = new ExtensionLibraryLinkStore({ db: options.db })
    this.relations = new ExtensionLibraryMediaRelationStore({ db: options.db })
    this.attachments = new ExtensionLibraryAttachmentStore({
      db: options.db,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
    this.graph = new ExtensionLibraryGraphManager({
      db: options.db,
      entities: this.entities,
      episodes: this.episodes,
      chapters: this.chapters,
      volumes: this.volumes,
      attachments: this.attachments,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
  }

  registerRpcHandlers(rpc: ExtensionHostRpcClient): void {
    for (const descriptor of this.createEntityRpcDescriptors()) {
      this.registerEntityRpcHandlers(rpc, descriptor)
    }

    rpc.handleHostRequest(
      'capabilities.library.graph.preview',
      async ({ runtimeHandle, input }, context) =>
        this.withRuntime(runtimeHandle, async () => ({
          result: await this.graph.preview(
            runtimeHandle,
            input as LibraryGraphInput,
            context.signal
          )
        }))
    )
    rpc.handleHostRequest(
      'capabilities.library.graph.apply',
      async ({ runtimeHandle, input }, context) =>
        this.withRuntime(runtimeHandle, async () => ({
          result: await this.graph.apply(runtimeHandle, input as LibraryGraphInput, context.signal)
        }))
    )

    rpc.handleHostRequest(
      'capabilities.library.animes.episodes.list',
      async ({ runtimeHandle, query }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryAnimeEpisodeQuery(query)
          return { items: this.episodes.list(query) }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.animes.episodes.create',
      async ({ runtimeHandle, animeId, input }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryEntityId(animeId, 'library.animes.episodes.create animeId')
          assertValidLibraryAnimeEpisodeCreateInput(input)
          return { episode: this.episodes.create(animeId, input) }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.animes.episodes.patchWatchState',
      async ({ runtimeHandle, episodeId, patch }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryEntityId(episodeId, 'library.animes.episodes.patchWatchState id')
          assertValidLibraryAnimeEpisodeWatchStatePatch(patch)
          return { episode: this.episodes.patchWatchState(episodeId, patch) }
        })
    )

    rpc.handleHostRequest(
      'capabilities.library.comics.chapters.list',
      async ({ runtimeHandle, query }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryComicChapterQuery(query)
          return { items: this.chapters.list(query) }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.comics.chapters.create',
      async ({ runtimeHandle, comicId, input }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryEntityId(comicId, 'library.comics.chapters.create comicId')
          assertValidLibraryComicChapterCreateInput(input)
          return { chapter: this.chapters.create(comicId, input) }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.comics.chapters.patchReadState',
      async ({ runtimeHandle, chapterId, patch }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryEntityId(chapterId, 'library.comics.chapters.patchReadState id')
          assertValidLibraryComicChapterReadStatePatch(patch)
          return { chapter: this.chapters.patchReadState(chapterId, patch) }
        })
    )

    rpc.handleHostRequest(
      'capabilities.library.novels.volumes.list',
      async ({ runtimeHandle, query }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryNovelVolumeQuery(query)
          return { items: this.volumes.list(query) }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.novels.volumes.create',
      async ({ runtimeHandle, novelId, input }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryEntityId(novelId, 'library.novels.volumes.create novelId')
          assertValidLibraryNovelVolumeCreateInput(input)
          return { volume: this.volumes.create(novelId, input) }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.novels.volumes.patchReadState',
      async ({ runtimeHandle, volumeId, patch }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryEntityId(volumeId, 'library.novels.volumes.patchReadState id')
          assertValidLibraryNovelVolumeReadStatePatch(patch)
          return { volume: this.volumes.patchReadState(volumeId, patch) }
        })
    )

    rpc.handleHostRequest('capabilities.library.links.list', async ({ runtimeHandle, query }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryLinkQuery(query)
        return { items: this.links.list(query) }
      })
    )
    rpc.handleHostRequest('capabilities.library.links.create', async ({ runtimeHandle, input }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryLinkCreateInput(input)
        return { link: this.links.create(input) }
      })
    )
    rpc.handleHostRequest(
      'capabilities.library.links.update',
      async ({ runtimeHandle, selector, patch }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryLinkUpdateInput(selector, patch)
          return {
            link: this.links.update(selector, patch)
          }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.links.remove',
      async ({ runtimeHandle, selector }) => {
        return this.withRuntimeAction(runtimeHandle, () => {
          assertValidLibraryLinkSelector(selector)
          this.links.remove(selector)
        })
      }
    )

    rpc.handleHostRequest('capabilities.library.relations.list', async ({ runtimeHandle, query }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryMediaRelationQuery(query)
        return { items: this.relations.list(query) }
      })
    )
    rpc.handleHostRequest(
      'capabilities.library.relations.create',
      async ({ runtimeHandle, input }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryMediaRelationCreateInput(input)
          return { relation: this.relations.create(input) }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.relations.update',
      async ({ runtimeHandle, selector, patch }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryMediaRelationUpdateInput(selector, patch)
          return {
            relation: this.relations.update(selector, patch)
          }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.relations.remove',
      async ({ runtimeHandle, selector }) => {
        return this.withRuntimeAction(runtimeHandle, () => {
          assertValidLibraryMediaRelationSelector(selector)
          this.relations.remove(selector)
        })
      }
    )

    rpc.handleHostRequest(
      'capabilities.library.attachments.list',
      async ({ runtimeHandle, entity }) =>
        this.withRuntime(runtimeHandle, async () => {
          assertValidLibraryAttachmentOwnerReference(entity)
          return {
            items: await this.attachments.list(entity)
          }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.attachments.put',
      async ({ runtimeHandle, input }, context) =>
        this.withRuntime(runtimeHandle, async () => {
          assertValidLibraryAttachmentWriteInput(input)
          return {
            attachment: await this.attachments.put(runtimeHandle, input, context.signal)
          }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.attachments.remove',
      async ({ runtimeHandle, input }) => {
        return this.withRuntimeAction(runtimeHandle, () => {
          assertValidLibraryAttachmentRemoveInput(input)
          return this.attachments.remove(input)
        })
      }
    )
  }

  private createEntityRpcDescriptors(): readonly [
    LibraryEntityRpcDescriptor<
      'games',
      LibraryGame,
      LibraryGameCreateInput,
      LibraryGamePatch,
      LibraryGameQuery
    >,
    LibraryEntityRpcDescriptor<
      'animes',
      LibraryAnime,
      LibraryAnimeCreateInput,
      LibraryAnimePatch,
      LibraryAnimeQuery
    >,
    LibraryEntityRpcDescriptor<
      'comics',
      LibraryComic,
      LibraryComicCreateInput,
      LibraryComicPatch,
      LibraryComicQuery
    >,
    LibraryEntityRpcDescriptor<
      'novels',
      LibraryNovel,
      LibraryNovelCreateInput,
      LibraryNovelPatch,
      LibraryNovelQuery
    >,
    LibraryEntityRpcDescriptor<
      'characters',
      LibraryCharacter,
      LibraryCharacterCreateInput,
      LibraryCharacterPatch,
      LibraryCharacterQuery
    >,
    LibraryEntityRpcDescriptor<
      'persons',
      LibraryPerson,
      LibraryPersonCreateInput,
      LibraryPersonPatch,
      LibraryPersonQuery
    >,
    LibraryEntityRpcDescriptor<
      'companies',
      LibraryCompany,
      LibraryCompanyCreateInput,
      LibraryCompanyPatch,
      LibraryCompanyQuery
    >,
    LibraryEntityRpcDescriptor<
      'collections',
      LibraryCollection,
      LibraryCollectionCreateInput,
      LibraryCollectionPatch,
      LibraryCollectionQuery
    >,
    LibraryEntityRpcDescriptor<
      'tags',
      LibraryTag,
      LibraryTagCreateInput,
      LibraryTagPatch,
      LibraryTagQuery
    >
  ] {
    return [
      {
        namespace: 'games',
        methods: createLibraryEntityRpcMethods('games'),
        get: (id) => this.entities.getGame(id),
        list: (query) => this.entities.listGames(query),
        create: (input) => this.entities.createGame(input),
        update: (id, patch) => this.entities.updateGame(id, patch),
        remove: (id) => this.entities.removeGame(id),
        assertQuery: assertValidLibraryGameQuery,
        assertCreate: assertValidLibraryGameCreateInput,
        assertPatch: assertValidLibraryGamePatch
      },
      {
        namespace: 'animes',
        methods: createLibraryEntityRpcMethods('animes'),
        get: (id) => this.entities.getAnime(id),
        list: (query) => this.entities.listAnimes(query),
        create: (input) => this.entities.createAnime(input),
        update: (id, patch) => this.entities.updateAnime(id, patch),
        remove: (id) => this.entities.removeAnime(id),
        assertQuery: assertValidLibraryAnimeQuery,
        assertCreate: assertValidLibraryAnimeCreateInput,
        assertPatch: assertValidLibraryAnimePatch
      },
      {
        namespace: 'comics',
        methods: createLibraryEntityRpcMethods('comics'),
        get: (id) => this.entities.getComic(id),
        list: (query) => this.entities.listComics(query),
        create: (input) => this.entities.createComic(input),
        update: (id, patch) => this.entities.updateComic(id, patch),
        remove: (id) => this.entities.removeComic(id),
        assertQuery: assertValidLibraryComicQuery,
        assertCreate: assertValidLibraryComicCreateInput,
        assertPatch: assertValidLibraryComicPatch
      },
      {
        namespace: 'novels',
        methods: createLibraryEntityRpcMethods('novels'),
        get: (id) => this.entities.getNovel(id),
        list: (query) => this.entities.listNovels(query),
        create: (input) => this.entities.createNovel(input),
        update: (id, patch) => this.entities.updateNovel(id, patch),
        remove: (id) => this.entities.removeNovel(id),
        assertQuery: assertValidLibraryNovelQuery,
        assertCreate: assertValidLibraryNovelCreateInput,
        assertPatch: assertValidLibraryNovelPatch
      },
      {
        namespace: 'characters',
        methods: createLibraryEntityRpcMethods('characters'),
        get: (id) => this.entities.getCharacter(id),
        list: (query) => this.entities.listCharacters(query),
        create: (input) => this.entities.createCharacter(input),
        update: (id, patch) => this.entities.updateCharacter(id, patch),
        remove: (id) => this.entities.removeCharacter(id),
        assertQuery: assertValidLibraryCharacterQuery,
        assertCreate: assertValidLibraryCharacterCreateInput,
        assertPatch: assertValidLibraryCharacterPatch
      },
      {
        namespace: 'persons',
        methods: createLibraryEntityRpcMethods('persons'),
        get: (id) => this.entities.getPerson(id),
        list: (query) => this.entities.listPersons(query),
        create: (input) => this.entities.createPerson(input),
        update: (id, patch) => this.entities.updatePerson(id, patch),
        remove: (id) => this.entities.removePerson(id),
        assertQuery: assertValidLibraryPersonQuery,
        assertCreate: assertValidLibraryPersonCreateInput,
        assertPatch: assertValidLibraryPersonPatch
      },
      {
        namespace: 'companies',
        methods: createLibraryEntityRpcMethods('companies'),
        get: (id) => this.entities.getCompany(id),
        list: (query) => this.entities.listCompanies(query),
        create: (input) => this.entities.createCompany(input),
        update: (id, patch) => this.entities.updateCompany(id, patch),
        remove: (id) => this.entities.removeCompany(id),
        assertQuery: assertValidLibraryCompanyQuery,
        assertCreate: assertValidLibraryCompanyCreateInput,
        assertPatch: assertValidLibraryCompanyPatch
      },
      {
        namespace: 'collections',
        methods: createLibraryEntityRpcMethods('collections'),
        get: (id) => this.entities.getCollection(id),
        list: (query) => this.entities.listCollections(query),
        create: (input) => this.entities.createCollection(input),
        update: (id, patch) => this.entities.updateCollection(id, patch),
        remove: (id) => this.entities.removeCollection(id),
        assertQuery: assertValidLibraryCollectionQuery,
        assertCreate: assertValidLibraryCollectionCreateInput,
        assertPatch: assertValidLibraryCollectionPatch
      },
      {
        namespace: 'tags',
        methods: createLibraryEntityRpcMethods('tags'),
        get: (id) => this.entities.getTag(id),
        list: (query) => this.entities.listTags(query),
        create: (input) => this.entities.createTag(input),
        update: (id, patch) => this.entities.updateTag(id, patch),
        remove: (id) => this.entities.removeTag(id),
        assertQuery: assertValidLibraryTagQuery,
        assertCreate: assertValidLibraryTagCreateInput,
        assertPatch: assertValidLibraryTagPatch
      }
    ]
  }

  private registerEntityRpcHandlers<
    TNamespace extends LibraryEntityNamespaceName,
    TEntity,
    TCreate,
    TPatch,
    TQuery
  >(
    rpc: ExtensionHostRpcClient,
    descriptor: LibraryEntityRpcDescriptor<TNamespace, TEntity, TCreate, TPatch, TQuery>
  ): void {
    rpc.handleHostRequest(descriptor.methods.get, async (params: unknown) => {
      const { runtimeHandle, id } = params as { runtimeHandle: string; id: unknown }
      return this.withRuntime(runtimeHandle, () => {
        assertValidLibraryEntityId(id, `library.${descriptor.namespace}.get id`)
        return { entity: descriptor.get(id) }
      }) as never
    })
    rpc.handleHostRequest(descriptor.methods.list, async (params: unknown) => {
      const { runtimeHandle, query } = params as { runtimeHandle: string; query?: unknown }
      return this.withRuntime(runtimeHandle, () => {
        descriptor.assertQuery(query)
        return { items: descriptor.list(query) }
      }) as never
    })
    rpc.handleHostRequest(descriptor.methods.create, async (params: unknown) => {
      const { runtimeHandle, input } = params as { runtimeHandle: string; input: unknown }
      return this.withRuntime(runtimeHandle, () => {
        descriptor.assertCreate(input)
        return { entity: descriptor.create(input) }
      }) as never
    })
    rpc.handleHostRequest(descriptor.methods.update, async (params: unknown) => {
      const { runtimeHandle, id, patch } = params as {
        runtimeHandle: string
        id: unknown
        patch: unknown
      }
      return this.withRuntime(runtimeHandle, () => {
        assertValidLibraryEntityId(id, `library.${descriptor.namespace}.update id`)
        descriptor.assertPatch(patch)
        return { entity: descriptor.update(id, patch) }
      }) as never
    })
    rpc.handleHostRequest(descriptor.methods.remove, async (params: unknown) => {
      const { runtimeHandle, id } = params as { runtimeHandle: string; id: unknown }
      return this.withRuntimeAction(runtimeHandle, () => {
        assertValidLibraryEntityId(id, `library.${descriptor.namespace}.remove id`)
        descriptor.remove(id)
      }) as never
    })
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }

  private withRuntime<T>(runtimeHandle: string, callback: () => T): T {
    this.requireRuntime(runtimeHandle)
    return callback()
  }

  private async withRuntimeAction(
    runtimeHandle: string,
    action: () => void | Promise<void>
  ): Promise<Record<string, never>> {
    return this.withRuntime(runtimeHandle, async () => {
      await action()
      return {}
    })
  }
}

function createLibraryEntityRpcMethods<TNamespace extends LibraryEntityNamespaceName>(
  namespace: TNamespace
): LibraryEntityRpcDescriptor<TNamespace, unknown, unknown, unknown, unknown>['methods'] {
  return {
    get: `capabilities.library.${namespace}.get` as LibraryEntityRpcMethod<TNamespace, 'get'>,
    list: `capabilities.library.${namespace}.list` as LibraryEntityRpcMethod<TNamespace, 'list'>,
    create: `capabilities.library.${namespace}.create` as LibraryEntityRpcMethod<
      TNamespace,
      'create'
    >,
    update: `capabilities.library.${namespace}.update` as LibraryEntityRpcMethod<
      TNamespace,
      'update'
    >,
    remove: `capabilities.library.${namespace}.remove` as LibraryEntityRpcMethod<
      TNamespace,
      'remove'
    >
  }
}
