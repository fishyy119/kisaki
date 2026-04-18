export type MaybePromise<T> = T | Promise<T>

export interface Disposable {
  dispose(): MaybePromise<void>
}

export interface DisposableStore extends Disposable {
  readonly size: number
  add<T extends Disposable>(disposable: T): T
  delete(disposable: Disposable): boolean
  clear(): MaybePromise<void>
}
