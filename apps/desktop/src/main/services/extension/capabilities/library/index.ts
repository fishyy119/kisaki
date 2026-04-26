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
  type ExtensionRuntimeMetadata
} from '@kisaki/extension-api'
import type { DbService } from '@main/services/db'
import type { ExtensionHostRpcClient } from '../../runtime/rpc-client'
import { ExtensionLibraryAttachmentsHost } from './attachments'
import { ExtensionLibraryEntitiesHost } from './entities'
import { ExtensionLibraryRelationsHost } from './relations'

export interface ExtensionLibraryCapabilityHostOptions {
  db: DbService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionLibraryCapabilityHost {
  readonly entities: ExtensionLibraryEntitiesHost
  readonly relations: ExtensionLibraryRelationsHost
  readonly attachments: ExtensionLibraryAttachmentsHost

  constructor(private readonly options: ExtensionLibraryCapabilityHostOptions) {
    this.entities = new ExtensionLibraryEntitiesHost({ db: options.db })
    this.relations = new ExtensionLibraryRelationsHost({ db: options.db })
    this.attachments = new ExtensionLibraryAttachmentsHost({
      db: options.db,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
  }

  registerRpcHandlers(rpc: ExtensionHostRpcClient): void {
    rpc.handleHostRequest('capabilities.library.games.get', async ({ runtimeHandle, id }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryEntityId(id, 'library.games.get id')
        return { entity: this.entities.getGame(id) }
      })
    )
    rpc.handleHostRequest('capabilities.library.games.list', async ({ runtimeHandle, query }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryGameQuery(query)
        return { items: this.entities.listGames(query) }
      })
    )
    rpc.handleHostRequest('capabilities.library.games.create', async ({ runtimeHandle, input }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryGameCreateInput(input)
        return { entity: this.entities.createGame(input) }
      })
    )
    rpc.handleHostRequest(
      'capabilities.library.games.update',
      async ({ runtimeHandle, id, patch }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryEntityId(id, 'library.games.update id')
          assertValidLibraryGamePatch(patch)
          return { entity: this.entities.updateGame(id, patch) }
        })
    )
    rpc.handleHostRequest('capabilities.library.games.remove', async ({ runtimeHandle, id }) => {
      return this.withRuntimeAction(runtimeHandle, () => {
        assertValidLibraryEntityId(id, 'library.games.remove id')
        this.entities.removeGame(id)
      })
    })

    rpc.handleHostRequest('capabilities.library.characters.get', async ({ runtimeHandle, id }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryEntityId(id, 'library.characters.get id')
        return { entity: this.entities.getCharacter(id) }
      })
    )
    rpc.handleHostRequest(
      'capabilities.library.characters.list',
      async ({ runtimeHandle, query }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryCharacterQuery(query)
          return { items: this.entities.listCharacters(query) }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.characters.create',
      async ({ runtimeHandle, input }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryCharacterCreateInput(input)
          return {
            entity: this.entities.createCharacter(input)
          }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.characters.update',
      async ({ runtimeHandle, id, patch }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryEntityId(id, 'library.characters.update id')
          assertValidLibraryCharacterPatch(patch)
          return {
            entity: this.entities.updateCharacter(id, patch)
          }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.characters.remove',
      async ({ runtimeHandle, id }) => {
        return this.withRuntimeAction(runtimeHandle, () => {
          assertValidLibraryEntityId(id, 'library.characters.remove id')
          this.entities.removeCharacter(id)
        })
      }
    )

    rpc.handleHostRequest('capabilities.library.persons.get', async ({ runtimeHandle, id }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryEntityId(id, 'library.persons.get id')
        return { entity: this.entities.getPerson(id) }
      })
    )
    rpc.handleHostRequest('capabilities.library.persons.list', async ({ runtimeHandle, query }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryPersonQuery(query)
        return { items: this.entities.listPersons(query) }
      })
    )
    rpc.handleHostRequest('capabilities.library.persons.create', async ({ runtimeHandle, input }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryPersonCreateInput(input)
        return { entity: this.entities.createPerson(input) }
      })
    )
    rpc.handleHostRequest(
      'capabilities.library.persons.update',
      async ({ runtimeHandle, id, patch }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryEntityId(id, 'library.persons.update id')
          assertValidLibraryPersonPatch(patch)
          return { entity: this.entities.updatePerson(id, patch) }
        })
    )
    rpc.handleHostRequest('capabilities.library.persons.remove', async ({ runtimeHandle, id }) => {
      return this.withRuntimeAction(runtimeHandle, () => {
        assertValidLibraryEntityId(id, 'library.persons.remove id')
        this.entities.removePerson(id)
      })
    })

    rpc.handleHostRequest('capabilities.library.companies.get', async ({ runtimeHandle, id }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryEntityId(id, 'library.companies.get id')
        return { entity: this.entities.getCompany(id) }
      })
    )
    rpc.handleHostRequest('capabilities.library.companies.list', async ({ runtimeHandle, query }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryCompanyQuery(query)
        return { items: this.entities.listCompanies(query) }
      })
    )
    rpc.handleHostRequest(
      'capabilities.library.companies.create',
      async ({ runtimeHandle, input }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryCompanyCreateInput(input)
          return { entity: this.entities.createCompany(input) }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.companies.update',
      async ({ runtimeHandle, id, patch }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryEntityId(id, 'library.companies.update id')
          assertValidLibraryCompanyPatch(patch)
          return {
            entity: this.entities.updateCompany(id, patch)
          }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.companies.remove',
      async ({ runtimeHandle, id }) => {
        return this.withRuntimeAction(runtimeHandle, () => {
          assertValidLibraryEntityId(id, 'library.companies.remove id')
          this.entities.removeCompany(id)
        })
      }
    )

    rpc.handleHostRequest('capabilities.library.collections.get', async ({ runtimeHandle, id }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryEntityId(id, 'library.collections.get id')
        return { entity: this.entities.getCollection(id) }
      })
    )
    rpc.handleHostRequest(
      'capabilities.library.collections.list',
      async ({ runtimeHandle, query }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryCollectionQuery(query)
          return { items: this.entities.listCollections(query) }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.collections.create',
      async ({ runtimeHandle, input }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryCollectionCreateInput(input)
          return {
            entity: this.entities.createCollection(input)
          }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.collections.update',
      async ({ runtimeHandle, id, patch }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryEntityId(id, 'library.collections.update id')
          assertValidLibraryCollectionPatch(patch)
          return {
            entity: this.entities.updateCollection(id, patch)
          }
        })
    )
    rpc.handleHostRequest(
      'capabilities.library.collections.remove',
      async ({ runtimeHandle, id }) => {
        return this.withRuntimeAction(runtimeHandle, () => {
          assertValidLibraryEntityId(id, 'library.collections.remove id')
          this.entities.removeCollection(id)
        })
      }
    )

    rpc.handleHostRequest('capabilities.library.tags.get', async ({ runtimeHandle, id }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryEntityId(id, 'library.tags.get id')
        return { entity: this.entities.getTag(id) }
      })
    )
    rpc.handleHostRequest('capabilities.library.tags.list', async ({ runtimeHandle, query }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryTagQuery(query)
        return { items: this.entities.listTags(query) }
      })
    )
    rpc.handleHostRequest('capabilities.library.tags.create', async ({ runtimeHandle, input }) =>
      this.withRuntime(runtimeHandle, () => {
        assertValidLibraryTagCreateInput(input)
        return { entity: this.entities.createTag(input) }
      })
    )
    rpc.handleHostRequest(
      'capabilities.library.tags.update',
      async ({ runtimeHandle, id, patch }) =>
        this.withRuntime(runtimeHandle, () => {
          assertValidLibraryEntityId(id, 'library.tags.update id')
          assertValidLibraryTagPatch(patch)
          return { entity: this.entities.updateTag(id, patch) }
        })
    )
    rpc.handleHostRequest('capabilities.library.tags.remove', async ({ runtimeHandle, id }) => {
      return this.withRuntimeAction(runtimeHandle, () => {
        assertValidLibraryEntityId(id, 'library.tags.remove id')
        this.entities.removeTag(id)
      })
    })

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
