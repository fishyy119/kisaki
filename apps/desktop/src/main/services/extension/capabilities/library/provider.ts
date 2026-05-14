import {
  assertValidLibraryAttachmentOwnerReference,
  assertValidLibraryAttachmentRemoveInput,
  assertValidLibraryAttachmentWriteInput,
  assertValidLibraryCharacterCreateInput,
  assertValidLibraryCharacterPatch,
  assertValidLibraryCharacterQuery,
  assertValidLibraryCollectionCreateInput,
  assertValidLibraryCollectionPatch,
  assertValidLibraryCollectionQuery,
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
  assertValidLibraryRelationCreateInput,
  assertValidLibraryRelationQuery,
  assertValidLibraryRelationSelector,
  assertValidLibraryRelationUpdateInput,
  assertValidLibraryTagCreateInput,
  assertValidLibraryTagPatch,
  assertValidLibraryTagQuery,
  createUnavailableError,
  type ExtensionRuntimeMetadata,
  type HostToMainRpcMethod,
  type LibraryCharacter,
  type LibraryCharacterCreateInput,
  type LibraryCharacterPatch,
  type LibraryCharacterQuery,
  type LibraryCollection,
  type LibraryCollectionCreateInput,
  type LibraryCollectionPatch,
  type LibraryCollectionQuery,
  type LibraryCompany,
  type LibraryCompanyCreateInput,
  type LibraryCompanyPatch,
  type LibraryCompanyQuery,
  type LibraryGame,
  type LibraryGameCreateInput,
  type LibraryGamePatch,
  type LibraryGameQuery,
  type LibraryPerson,
  type LibraryPersonCreateInput,
  type LibraryPersonPatch,
  type LibraryPersonQuery,
  type LibraryTag,
  type LibraryTagCreateInput,
  type LibraryTagPatch,
  type LibraryTagQuery
} from '@kisaki/extension-api'
import type { DbService } from '@main/services/db'
import type { ExtensionHostRpcClient } from '../../runtime'
import { ExtensionLibraryAttachmentStore } from './attachments'
import { ExtensionLibraryEntityStore } from './entities'
import { ExtensionLibraryRelationStore } from './relations'

type LibraryEntityNamespaceName =
  | 'games'
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
  readonly relations: ExtensionLibraryRelationStore
  readonly attachments: ExtensionLibraryAttachmentStore

  constructor(private readonly options: ExtensionLibraryCapabilityProviderOptions) {
    this.entities = new ExtensionLibraryEntityStore({ db: options.db })
    this.relations = new ExtensionLibraryRelationStore({ db: options.db })
    this.attachments = new ExtensionLibraryAttachmentStore({
      db: options.db,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
  }

  registerRpcHandlers(rpc: ExtensionHostRpcClient): void {
    for (const descriptor of this.createEntityRpcDescriptors()) {
      this.registerEntityRpcHandlers(rpc, descriptor)
    }

    rpc.handleHostRequest('capabilities.library.relations.list', async ({ runtimeHandle, query }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryRelationQuery(query)
        return { items: this.relations.list(query) }
      })
    )
    rpc.handleHostRequest(
      'capabilities.library.relations.create',
      async ({ runtimeHandle, input }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryRelationCreateInput(input)
          return { relation: this.relations.create(input) }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.relations.update',
      async ({ runtimeHandle, selector, patch }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryRelationUpdateInput(selector, patch)
          return {
            relation: this.relations.update(selector, patch)
          }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.relations.remove',
      async ({ runtimeHandle, selector }) => {
        return this.withRuntimeAction(runtimeHandle, () => {
          assertValidLibraryRelationSelector(selector)
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
