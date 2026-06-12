import type { Disposable, MaybePromise } from '../../shared'

/**
 * Action rendered on the extension's card in the extension management UI.
 * @remarks `run` is the imperative entry point; open webviews or perform work
 * directly from it. Thrown errors surface to the user as structured toasts.
 */
export interface CardActionContribution {
  id: string
  label: string
  description?: string
  order?: number
  run(): MaybePromise<void>
}

export type CardActionRegistration = Disposable

export interface CardActionRegistrar {
  register(action: CardActionContribution): CardActionRegistration
}
