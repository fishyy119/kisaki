import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@shared/db'
import { EntityDeleter } from './deleter'
import { EntityFinder } from './finder'

export class HelperStore {
  private readonly finder: EntityFinder
  private readonly deleter: EntityDeleter

  constructor(db: BetterSQLite3Database<typeof schema>) {
    this.finder = new EntityFinder(db)
    this.deleter = new EntityDeleter(db)
  }

  findExistingPerson(
    ...args: Parameters<EntityFinder['findExistingPerson']>
  ): ReturnType<EntityFinder['findExistingPerson']> {
    return this.finder.findExistingPerson(...args)
  }

  findExistingCompany(
    ...args: Parameters<EntityFinder['findExistingCompany']>
  ): ReturnType<EntityFinder['findExistingCompany']> {
    return this.finder.findExistingCompany(...args)
  }

  findExistingCharacter(
    ...args: Parameters<EntityFinder['findExistingCharacter']>
  ): ReturnType<EntityFinder['findExistingCharacter']> {
    return this.finder.findExistingCharacter(...args)
  }

  findExistingGame(
    ...args: Parameters<EntityFinder['findExistingGame']>
  ): ReturnType<EntityFinder['findExistingGame']> {
    return this.finder.findExistingGame(...args)
  }

  findExistingTag(
    ...args: Parameters<EntityFinder['findExistingTag']>
  ): ReturnType<EntityFinder['findExistingTag']> {
    return this.finder.findExistingTag(...args)
  }

  getAppSettings(
    ...args: Parameters<EntityFinder['getAppSettings']>
  ): ReturnType<EntityFinder['getAppSettings']> {
    return this.finder.getAppSettings(...args)
  }

  previewEntityDelete(
    ...args: Parameters<EntityDeleter['preview']>
  ): ReturnType<EntityDeleter['preview']> {
    return this.deleter.preview(...args)
  }

  deleteEntities(
    ...args: Parameters<EntityDeleter['delete']>
  ): ReturnType<EntityDeleter['delete']> {
    return this.deleter.delete(...args)
  }
}
